# Production Email Setup (SES)

**Status:** In Progress
**Region:** us-west-2
**Domain:** specboard.io
**Sender:** noreply@specboard.io

## Background

The codebase is fully wired for SES email sending (`@specboard/email` package, IAM permissions in CDK, environment variables in ECS). What's missing is the AWS-side SES configuration: domain verification, DKIM, bounce handling, and production access (sandbox removal).

A previous staging attempt may have been denied by AWS. Common denial reasons include vague request language, missing prerequisites (DKIM, bounce handling), or automated screening of the request text. This guide is designed to be followed manually by a human to avoid any automated rejection patterns.

## Current State (checked 2026-02-25)

| Item | Status |
|------|--------|
| Domain identity (specboard.io) | VERIFIED |
| DKIM (2048-bit RSA) | SUCCESS, signing enabled |
| SPF record | NOT CONFIGURED |
| DMARC record | NOT CONFIGURED |
| SNS bounce/complaint topics | NOT CONFIGURED |
| SES notifications | NOT CONFIGURED |
| Custom MAIL FROM domain | NOT CONFIGURED |
| Production access | NOT ENABLED (sandbox) |
| Sandbox send quota | 200/day, 1/sec |
| Emails sent last 24h | 0 |

## Progress Log

- [x] Step 1: Verify domain identity (specboard.io) — previously done
- [x] Step 2: Configure DKIM (DNS records) — previously done, 2048-bit RSA, SUCCESS
- [x] Step 3: Configure SPF (DNS record) — added 2026-02-25 (`v=spf1 include:amazonses.com ~all`)
- [x] Step 4: Configure DMARC (DNS record) — added 2026-02-25 (`v=DMARC1; p=quarantine`)
- [x] Step 5: Set up SNS topics for bounces and complaints — created 2026-02-25
  - Bounce topic: `arn:aws:sns:us-west-2:317235967576:ses-bounces`
  - Complaint topic: `arn:aws:sns:us-west-2:317235967576:ses-complaints`
  - Note: Subscribe your monitoring email to both topics (see Step 5 below)
- [x] Step 6: Configure SES notifications (wire SNS topics) — done 2026-02-25, headers enabled
- [ ] Step 7: Test sending in sandbox mode (to verified email) — **START HERE**
- [ ] Step 8: Submit production access request
- [ ] Step 9: Verify end-to-end in staging
- [ ] Step 10: Verify end-to-end in production

---

## Step 1: Verify Domain Identity

This tells AWS you own specboard.io and are authorized to send email from it.

**In the AWS Console:**
1. Go to **SES Console** → **Identities** → **Create identity**
2. Select **Domain**
3. Enter: `specboard.io`
4. Under "Advanced DKIM settings", select **Easy DKIM**
5. Set DKIM signing key length to **2048 bits**
6. Check **Enabled** for DKIM signatures
7. Click **Create identity**

AWS will give you **3 CNAME records** for DKIM verification. You'll add these in Step 2.

**Alternatively, via CLI:**
```bash
aws sesv2 create-email-identity \
  --identity-name specboard.io \
  --region us-west-2
```

This returns the DKIM tokens in the response.

**Check if already done:**
```bash
aws sesv2 get-email-identity \
  --email-identity specboard.io \
  --region us-west-2
```

If this returns data, the identity already exists. Check `VerifiedForSendingStatus` — if true, skip to Step 3.

## Step 2: Configure DKIM (DNS Records)

DKIM cryptographically signs outgoing emails so recipients can verify they actually came from your domain. AWS reviewers check for this — having it configured before requesting production access significantly improves approval chances.

**Add these CNAME records in Route53** (or wherever specboard.io DNS is managed):

The 3 CNAME records from Step 1 will look like:
```
Name:  <token1>._domainkey.specboard.io
Value: <token1>.dkim.amazonses.com

Name:  <token2>._domainkey.specboard.io
Value: <token2>.dkim.amazonses.com

Name:  <token3>._domainkey.specboard.io
Value: <token3>.dkim.amazonses.com
```

**Verification:** After adding DNS records, AWS automatically detects them (can take up to 72 hours, usually minutes). Check status:
```bash
aws sesv2 get-email-identity \
  --email-identity specboard.io \
  --region us-west-2 \
  --query 'DkimAttributes.Status'
```

Wait until status is `SUCCESS` before proceeding.

## Step 3: Configure SPF (DNS Record)

SPF tells receiving mail servers which servers are authorized to send email for your domain. SES handles this automatically via the MAIL FROM domain, but adding an explicit SPF record for your domain adds credibility.

**Check if an SPF record already exists:**
```bash
dig TXT specboard.io +short | grep spf
```

**If no SPF record exists, add a TXT record:**
```
Name:  specboard.io
Type:  TXT
Value: "v=spf1 include:amazonses.com ~all"
```

**If an SPF record already exists**, add `include:amazonses.com` to it. For example:
```
"v=spf1 include:amazonses.com include:_spf.google.com ~all"
```

*Note: There can only be ONE SPF TXT record per domain.*

## Step 4: Configure DMARC (DNS Record)

DMARC ties SPF and DKIM together and tells receiving servers what to do with emails that fail authentication. Having DMARC configured shows AWS you take email seriously.

**Add a TXT record:**
```
Name:  _dmarc.specboard.io
Type:  TXT
Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@specboard.io; pct=100"
```

Policy options:
- `p=none` — monitor only (good to start with if unsure)
- `p=quarantine` — suspicious emails go to spam
- `p=reject` — reject unauthenticated emails entirely

Starting with `p=quarantine` is reasonable for a new domain. You can tighten to `p=reject` later.

*Note: The `rua` email address receives aggregate DMARC reports. You can change this to any address you monitor, or omit the `rua` tag entirely if you don't want reports.*

## Step 5: Set Up SNS Topics for Bounces and Complaints

This is a **critical prerequisite** for production access approval. AWS wants to see that you handle bounces (undeliverable emails) and complaints (recipients marking your email as spam) programmatically.

**Create SNS topics:**
```bash
# Create bounce notification topic
aws sns create-topic \
  --name ses-bounces \
  --region us-west-2

# Create complaint notification topic
aws sns create-topic \
  --name ses-complaints \
  --region us-west-2
```

**Subscribe your email to both topics** (so you can monitor them):
```bash
# Subscribe to bounces
aws sns subscribe \
  --topic-arn arn:aws:sns:us-west-2:ACCOUNT_ID:ses-bounces \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-west-2

# Subscribe to complaints
aws sns subscribe \
  --topic-arn arn:aws:sns:us-west-2:ACCOUNT_ID:ses-complaints \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-west-2
```

You'll receive confirmation emails — click the confirm links.

## Step 6: Configure SES Notifications

Wire the SNS topics to SES so bounces and complaints are actually routed.

**In the SES Console:**
1. Go to **Identities** → click **specboard.io**
2. Go to **Notifications** tab
3. Under **Bounce feedback**, select the `ses-bounces` SNS topic
4. Under **Complaint feedback**, select the `ses-complaints` SNS topic
5. Optionally enable **Email feedback forwarding** as a backup

**Via CLI:**
```bash
# Set bounce notifications
aws sesv2 put-email-identity-feedback-attributes \
  --email-identity specboard.io \
  --email-forwarding-enabled \
  --region us-west-2

aws sesv2 put-email-identity-notification-attributes \
  --email-identity specboard.io \
  --notification-topic arn:aws:sns:us-west-2:ACCOUNT_ID:ses-bounces \
  --notification-type Bounce \
  --region us-west-2

aws sesv2 put-email-identity-notification-attributes \
  --email-identity specboard.io \
  --notification-topic arn:aws:sns:us-west-2:ACCOUNT_ID:ses-complaints \
  --notification-type Complaint \
  --region us-west-2
```

## Step 7: Test Sending in Sandbox Mode

Before requesting production access, verify the whole pipeline works end-to-end in sandbox mode. In sandbox, you can only send to verified email addresses.

**Verify a test recipient email:**
```bash
aws sesv2 create-email-identity \
  --identity-name your-email@example.com \
  --region us-west-2
```

Click the verification link that arrives.

**Send a test email:**
```bash
aws sesv2 send-email \
  --from-email-address noreply@specboard.io \
  --destination "ToAddresses=your-email@example.com" \
  --content "Simple={Subject={Data='Specboard Test Email'},Body={Text={Data='This is a test from Specboard SES configuration.'}}}" \
  --region us-west-2
```

If this succeeds and you receive the email, the SES pipeline is working.

**Also test the actual application flow:**
- You could temporarily set `EMAIL_ALLOWLIST` in staging to include your personal email domain
- Try signing up or triggering a password reset in the staging app
- Verify the email arrives and links work

## Step 8: Submit Production Access Request

This is the critical step. The request should be written by you personally, with specific details about your application. Do NOT use AI-generated or template text.

**Go to:** SES Console → Account Dashboard → Request production access

**Form fields:**

| Field | Value |
|-------|-------|
| **Email Type** | Transactional |
| **Website URL** | https://specboard.io |
| **Additional Contacts** | Your email address |
| **Preferred Language** | English |

**Use case description — write this yourself, but cover these points:**

1. **What is Specboard:** A documentation and project planning platform for software teams. It's a SaaS web application.

2. **What emails you send (be specific):**
   - Account verification emails when users sign up (double opt-in)
   - Password reset emails when users request a reset
   - These are strictly transactional — no marketing, no newsletters, no bulk email

3. **How you get email addresses:**
   - Users provide their email during account registration on your website
   - You never purchase, scrape, or import email lists

4. **Volume:**
   - Initially very low: under 100 emails/day (early-stage product)
   - Emails are only triggered by explicit user actions (signup, password reset)

5. **Bounce and complaint handling:**
   - SNS topics configured for both bounces and complaints
   - Bounced addresses are monitored and would be flagged
   - Complaint rate monitoring in place

6. **Authentication:**
   - DKIM configured and verified
   - SPF record in place
   - DMARC policy configured

**Tips for the request text:**
- Write conversationally and specifically — don't sound like a template
- Mention that you've already configured DKIM, SPF, DMARC, and SNS bounce/complaint handling
- Emphasize "transactional only" and "user-initiated only"
- Give real numbers, even if small
- Check both acknowledgement boxes

**If denied:** You can resubmit. Add more detail, reference what you've already configured, and ask for specific feedback. Some people have succeeded by asking "How is this different from a password reset email?" to trigger a human review escalation.

## Step 9: Verify End-to-End in Staging

Once production access is granted:

1. The staging ECS service already has `APP_ENV=staging` and `EMAIL_ALLOWLIST=specboard.io`
2. Sign up for an account using a `@specboard.io` email address
3. Verify the verification email arrives
4. Test password reset flow
5. Check that non-allowlisted domains are still blocked in staging (logged only)

## Step 10: Verify End-to-End in Production

1. Production ECS has `APP_ENV=production` and empty `EMAIL_ALLOWLIST` (sends to everyone)
2. Sign up with a non-specboard email address
3. Verify verification email arrives
4. Test password reset flow
5. Monitor SNS topics for any bounces or complaints

---

## Architecture Reference

**Code path:** User action → API handler → `@specboard/email` `sendEmail()` → AWS SES

**Environment behavior:**
| Environment | `APP_ENV` | `EMAIL_ALLOWLIST` | Behavior |
|-------------|-----------|-------------------|----------|
| Development | `development` | (none) | Console logging only |
| Staging | `staging` | `specboard.io` | Sends only to @specboard.io |
| Production | `production` | (empty) | Sends to all addresses |

**IAM permissions** (already in CDK):
- `ses:SendEmail` and `ses:SendRawEmail` on `arn:aws:ses:us-west-2:*:identity/specboard.io` and `arn:aws:ses:us-west-2:*:identity/*@specboard.io`

**Source files:**
- Email client: `shared/email/src/client.ts`
- Email templates: `shared/email/src/templates.ts`
- CDK SES IAM: `infra/lib/specboard-stack.ts` (lines ~532-549)
- CDK env vars: `infra/lib/specboard-stack.ts` (lines ~482-485)
- Signup handler: `api/src/handlers/auth/signup.ts`
- Verification handler: `api/src/handlers/auth/verification.ts`
- Password reset handler: `api/src/handlers/auth/password.ts`

---

## Troubleshooting

**"Email address is not verified"**
- Domain identity not yet verified, or DKIM propagation incomplete
- Run: `aws sesv2 get-email-identity --email-identity specboard.io --region us-west-2`

**"Access denied" from ECS task**
- IAM role missing SES permissions — check CDK deployment applied cleanly
- Run: `aws iam list-attached-role-policies --role-name <api-task-role>`

**Emails going to spam**
- DKIM/SPF/DMARC not aligned — verify all 3 are configured
- Check: https://mail-tester.com (send a test email to their address for scoring)

**"Account is in sandbox"**
- Production access not yet granted, or granted in a different region
- Check: `aws sesv2 get-account --region us-west-2` → look for `ProductionAccessEnabled`

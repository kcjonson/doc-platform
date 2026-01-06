#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DocPlatformStack } from '../lib/doc-platform-stack';
import { getEnvironmentConfig } from '../lib/environment-config';

const app = new cdk.App();

// Get environment from context: --context env=staging (default) or --context env=production
const envName = app.node.tryGetContext('env') || 'staging';
const config = getEnvironmentConfig(envName);

// Stack name includes environment for clarity
const stackName = envName === 'staging' ? 'DocPlatformStack' : `DocPlatform-${config.name}`;

new DocPlatformStack(app, stackName, {
	config,
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
	},
});

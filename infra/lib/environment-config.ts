import * as ec2 from 'aws-cdk-lib/aws-ec2';

export type EnvironmentName = 'staging' | 'production';

export interface DatabaseConfig {
	instanceClass: ec2.InstanceClass;
	instanceSize: ec2.InstanceSize;
	multiAz: boolean;
	backupRetentionDays: number;
	deletionProtection: boolean;
}

export interface EcsConfig {
	desiredCount: number;
	cpu: number;
	memory: number;
}

export interface EnvironmentConfig {
	name: EnvironmentName;
	domain: string;
	subdomain?: string; // undefined = apex domain
	database: DatabaseConfig;
	ecs: EcsConfig;
	ecrMaxImageCount: number;
	emailAllowlist?: string; // Comma-separated domains, undefined = send to all
}

export const environments: Record<EnvironmentName, EnvironmentConfig> = {
	staging: {
		name: 'staging',
		domain: 'specboard.io',
		subdomain: 'staging',
		database: {
			instanceClass: ec2.InstanceClass.T4G,
			instanceSize: ec2.InstanceSize.MICRO,
			multiAz: false,
			backupRetentionDays: 1,
			deletionProtection: false,
		},
		ecs: {
			desiredCount: 1,
			cpu: 256,
			memory: 512,
		},
		ecrMaxImageCount: 3,
		emailAllowlist: 'specboard.io',
	},
	production: {
		name: 'production',
		domain: 'specboard.io',
		subdomain: undefined, // apex domain
		database: {
			instanceClass: ec2.InstanceClass.T4G,
			instanceSize: ec2.InstanceSize.SMALL,
			multiAz: true,
			backupRetentionDays: 7,
			deletionProtection: true,
		},
		ecs: {
			desiredCount: 2,
			cpu: 256,
			memory: 512,
		},
		ecrMaxImageCount: 10,
		emailAllowlist: undefined, // Send to all in production
	},
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
	const config = environments[envName as EnvironmentName];
	if (!config) {
		throw new Error(`Unknown environment: ${envName}. Valid values: staging, production`);
	}
	return config;
}

export function getFullDomain(config: EnvironmentConfig): string {
	return config.subdomain ? `${config.subdomain}.${config.domain}` : config.domain;
}

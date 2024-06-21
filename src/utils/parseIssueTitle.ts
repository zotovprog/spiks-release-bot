enum Environment {
    DEV = 'dev',
    STAGE = 'stage',
    PROD = 'prod',
}

enum ReleaseType {
    PATCH = 'patch',
    MINOR = 'minor',
    MAJOR = 'major',
}

interface Result {
    environments: Environment[];
    releaseType: ReleaseType;
}

export const parseIssueTitle = (input: string): Result => {
    const environments = input.match(/\b(dev|stage|prod)\b/g);
    const releaseType = input.match(/\b(patch|minor|major)\b/);

    if (!environments || environments.length === 0) {
        throw new Error('Invalid environment. Must be dev, stage, or prod.');
    }

    if (!releaseType || releaseType.length === 0) {
        throw new Error('Invalid release type. Must be patch, minor, or major.');
    }

    return {
        environments: environments.map(env => env as Environment),
        releaseType: releaseType[0] as ReleaseType,
    };
}

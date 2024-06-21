export const getNextVersion = (previousReleaseVersion: string, releaseType: string): string => {
    if (!previousReleaseVersion) {
        return "0.0.1";
    }

    const versionParts = previousReleaseVersion.split('.').map(Number);

    if (versionParts.length === 2) {
        versionParts.push(0);
    }

    switch (releaseType) {
        case "patch":
            versionParts[2]++;
            break;
        case "minor":
            versionParts[1]++;
            versionParts[2] = 0;
            break;
        case "major":
            versionParts[0]++;
            versionParts[1] = 0;
            versionParts[2] = 0;
            break;
        default:
            throw new Error(`Unknown release type: ${releaseType}`);
    }

    return versionParts.join('.');
}
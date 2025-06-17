export function getGetUserMedia(): ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null {
    if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
        return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }
    // @ts-ignore – legacy prefixes
    const legacy =
        // @ts-ignore
        navigator.getUserMedia ||
        // @ts-ignore
        navigator.webkitGetUserMedia ||
        // @ts-ignore
        navigator.mozGetUserMedia;
    if (legacy) {
        // wrap the callback API in a Promise
        return (constraints: MediaStreamConstraints) =>
            new Promise<MediaStream>((resolve, reject) => {
                legacy.call(navigator, constraints, resolve, reject);
            });
    }
    return null;
}
export function getGetUserMedia(): ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null {
    if (
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
    ) {
        return navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }
    
    const legacy =
        // @ts-expect-error: webkit-prefixed getUserMedia for older browsers
        navigator.getUserMedia ||
        // @ts-expect-error: webkit-prefixed getUserMedia for older browsers
        navigator.webkitGetUserMedia ||
        // @ts-expect-error: moz-prefixed getUserMedia for older browsers
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
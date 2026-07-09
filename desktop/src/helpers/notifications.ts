export async function desktopNotification(title: string, body: string) {
    if (!("Notification" in window)) {
        console.error("This browser does not support desktop notifications.");
        return;
    }

    if (Notification.permission === "granted") {
        new Notification(title, { body });
        return;
    }

    if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
            new Notification(title, { body });
        }
    }
}
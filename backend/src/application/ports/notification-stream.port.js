/**
 * Runtime contract check for NotificationStream port.
 * @param {unknown} port
 */
export function assertNotificationStreamPort(port) {
  if (!port || typeof port !== "object") {
    throw new Error("NotificationStream port must be an object");
  }

  const required = [
    "addSubscriber",
    "removeSubscriber",
    "broadcast",
    "pingAll",
    "getSubscriberCount",
  ];

  for (const method of required) {
    if (typeof port[method] !== "function") {
      throw new Error(`NotificationStream port missing method: ${method}`);
    }
  }
}

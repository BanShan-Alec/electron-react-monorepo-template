export function createIdleRefresh(request: () => Promise<unknown>) {
  let requestInFlight = false;

  return () => {
    if (requestInFlight) return;

    requestInFlight = true;
    void Promise.resolve()
      .then(request)
      .catch(() => undefined)
      .finally(() => {
        requestInFlight = false;
      });
  };
}

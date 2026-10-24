// Acquire before integrations initialize; a duplicate must not start services.
export function enforceSingleInstance(app, showWindow) {
  if (!app.requestSingleInstanceLock()) {
    app.exit(0);
    return false;
  }
  app.on('second-instance', () => showWindow());
  return true;
}

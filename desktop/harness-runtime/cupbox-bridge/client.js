window.__ModuleLoader__.load({
  id: 'cupbox-harness-bridge',
  factory: () => ({
    inject: ['uiWorkspace'],
    apply(ctx) {
      const bridge = Object.freeze({
        openSession(id) {
          if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(id)) throw Error('Invalid session identity');
          ctx.uiWorkspace.openSession(id);
          return {opened: true};
        }
      });
      ctx.effect(() => {
        window.CupboxHarnessBridge = bridge;
        return () => { if (window.CupboxHarnessBridge === bridge) delete window.CupboxHarnessBridge; };
      });
    }
  })
});

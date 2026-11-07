window.__ModuleLoader__.load({
  id: 'dsh-sidebar-panel-fold',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Browser-local preference key; one flag for the whole window. */
    const STORAGE_KEY = 'dsh.sidebar-panel-fold.v1';
    /** Attribute that hides the panel list; CSS below only reacts to it. */
    const FOLD_ATTR = 'data-dsh-panels-folded';
    /** Current shipped class of the panel list navigation, used as the fast path. */
    const NAV_SELECTOR = 'nav.kB3qhq_panelList';

    const subscribers = new Set();
    let navNode = null;
    let folded = readPreference();
    let rafHandle = 0;
    let observer = null;

    function readPreference() {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === '1';
      } catch (_error) {
        return false;
      }
    }

    function writePreference(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
      } catch (_error) {
        /* storage may be unavailable in a private window; the session still works */
      }
    }

    function zh() {
      const tag = document.documentElement.lang || navigator.language || '';
      return /^zh/i.test(tag);
    }

    function text() {
      return zh()
        ? {
            command: '折叠面板列表',
            title: '面板列表',
            hide: '折叠面板列表（⌥⌘P）',
            show: '展开面板列表（⌥⌘P）',
            hint: '隐藏「插件」到「更多」那一列，让工作区上移',
          }
        : {
            command: 'Collapse panel list',
            title: 'Panels',
            hide: 'Collapse the panel list (⌥⌘P)',
            show: 'Expand the panel list (⌥⌘P)',
            hint: 'Hide the Plugins…More column so Workspaces moves up',
          };
    }

    /**
     * Find the sidebar's global panel list. The class name is the fast path; the
     * fallback looks for the short navigation in the left column so a restyled
     * sidebar still collapses instead of silently doing nothing.
     */
    function locatePanelList() {
      const direct = document.querySelector(NAV_SELECTOR);
      if (direct !== null) return direct;
      const candidates = document.querySelectorAll('nav');
      let best = null;
      for (const nav of candidates) {
        if (nav.closest('[role="dialog"]') !== null) continue;
        if (nav.closest('[role="menu"]') !== null) continue;
        const rect = nav.getBoundingClientRect();
        if (rect.left > 430) continue;
        const rows = nav.querySelectorAll('button').length;
        const ours = nav.querySelector('[data-dsh-fold-toggle]') !== null;
        if (!ours && rows < 3) continue;
        if (rect.height > 520) continue;
        if (best === null || rect.height < best.height) best = { nav, height: rect.height };
      }
      return best === null ? null : best.nav;
    }

    /** Keep the fold header visible when the slot wraps registrations in its own element. */
    function markToggleHost(nav) {
      const toggle = nav.querySelector('[data-dsh-fold-toggle]');
      if (toggle === null) return;
      let row = toggle.parentElement;
      while (row !== null && row !== nav && row.tagName !== 'BUTTON') row = row.parentElement;
      if (row !== null && row !== nav) row.setAttribute('data-dsh-fold-row', '');
    }

    function paint() {
      const nav = resolvePanelList();
      if (nav === null) return;
      markToggleHost(nav);
      if (folded) nav.setAttribute(FOLD_ATTR, '');
      else nav.removeAttribute(FOLD_ATTR);
    }

    function resolvePanelList() {
      if (navNode !== null && navNode.isConnected) return navNode;
      navNode = locatePanelList();
      return navNode;
    }

    function paint() {
      const nav = resolvePanelList();
      if (nav === null) return;
      if (folded) nav.setAttribute(FOLD_ATTR, '');
      else nav.removeAttribute(FOLD_ATTR);
    }

    function notify() {
      for (const listener of [...subscribers]) {
        try {
          listener();
        } catch (error) {
          console.error('[sidebar-panel-fold] subscriber failed', error);
        }
      }
    }

    function setFolded(value) {
      if (folded === value) {
        paint();
        return;
      }
      folded = value;
      writePreference(value);
      paint();
      notify();
    }

    function toggle() {
      setFolded(!folded);
    }

    function schedule() {
      if (rafHandle !== 0) return;
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = 0;
        paint();
      });
    }

    function subscribe(listener) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    }

    /**
     * Header row that sits above the panel list: a symbol, the words "面板列表"
     * and a caret that flips with the state, so the control is obvious and
     * stays put once the rows below are folded away.
     */
    function FoldHeader() {
      const [, bump] = React.useState(0);
      const ref = React.useRef(null);
      React.useEffect(() => subscribe(() => bump((value) => value + 1)), []);
      /**
       * The slot renders a registration inside the row's glyph cell. Flatten the
       * wrappers with `display: contents` so this button becomes a direct child
       * of the row, then the row itself becomes the click target for the fold.
       */
      React.useEffect(() => {
        const node = ref.current;
        if (node === null) return undefined;
        let row = node.parentElement;
        while (row !== null && row.tagName !== 'BUTTON') row = row.parentElement;
        if (row === null) return undefined;
        row.setAttribute('data-dsh-fold-row', '');
        const flattened = [];
        let el = node.parentElement;
        while (el !== null && el !== row) {
          flattened.push(el);
          el.style.display = 'contents';
          el = el.parentElement;
        }
        /**
         * The icon cell is decorative for a normal row and ships `aria-hidden`,
         * which would hide this control from assistive tech; the row's own
         * activation is replaced by this button, so drop it and the extra stop.
         */
        const hidden = flattened.filter((element) => element.hasAttribute('aria-hidden'));
        for (const element of hidden) element.removeAttribute('aria-hidden');
        const previousTabIndex = row.getAttribute('tabindex');
        row.setAttribute('tabindex', '-1');
        return () => {
          row.removeAttribute('data-dsh-fold-row');
          for (const element of flattened) element.style.display = '';
          for (const element of hidden) element.setAttribute('aria-hidden', 'true');
          if (previousTabIndex === null) row.removeAttribute('tabindex');
          else row.setAttribute('tabindex', previousTabIndex);
        };
      }, []);
      const copy = text();
      const label = folded ? copy.show : copy.hide;
      return h(
        'button',
        {
          ref,
          type: 'button',
          className: 'dsh-panel-fold-header',
          'data-dsh-fold-toggle': '',
          'aria-expanded': folded ? 'false' : 'true',
          title: label,
          'aria-label': label,
          onClick(event) {
            event.preventDefault();
            event.stopPropagation();
            toggle();
          },
        },
        h(
          'svg',
          {
            className: 'dsh-panel-fold-glyph',
            viewBox: '0 0 16 16',
            width: 16,
            height: 16,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.4,
            strokeLinecap: 'round',
            'aria-hidden': true,
          },
          h('path', { d: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h7' }),
        ),
        h('span', { className: 'dsh-panel-fold-label' }, copy.title),
        h(
          'svg',
          {
            className: 'dsh-panel-fold-caret',
            viewBox: '0 0 16 16',
            width: 14,
            height: 14,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true,
          },
          h('path', { d: 'M4 6.5l4 4 4-4' }),
        ),
      );
    }

    const STYLE_ID = 'dsh-sidebar-panel-fold-style';

    const CSS = `
nav[${FOLD_ATTR}] > *:not([data-dsh-fold-row]){display:none !important}
[data-dsh-fold-row]{gap:0}
[data-dsh-fold-row] > *:not(:has([data-dsh-fold-toggle])){display:none !important}
.dsh-panel-fold-header{display:flex;flex:1 1 auto;align-items:center;gap:8px;width:100%;min-height:36px;box-sizing:border-box;padding:7px 9px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer;opacity:.66}
.dsh-panel-fold-header:hover{opacity:1;background:var(--dsw-alias-fill-secondary,rgba(127,127,127,.14))}
.dsh-panel-fold-header:focus-visible{outline:2px solid currentColor;outline-offset:1px}
.dsh-panel-fold-glyph{flex:0 0 auto}
.dsh-panel-fold-label{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsh-panel-fold-caret{flex:0 0 auto;transform-origin:50% 50%;transition:transform .15s ease}
.dsh-panel-fold-header[aria-expanded='false'] .dsh-panel-fold-caret{transform:rotate(-90deg)}
`;

    function installStyle() {
      if (document.getElementById(STYLE_ID) !== null) return () => {};
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        style.remove();
      };
    }

    /** Registers the command in the app's shortcut catalog so it is rebindable. */
    function registerShortcut(scoped) {
      const shortcuts = scoped && typeof scoped.get === 'function' ? scoped.get('shortcuts') : null;
      if (!shortcuts || typeof shortcuts.register !== 'function') return;
      const copy = text();
      const command = {
        id: 'sidebar.foldPanels',
        label: () => text().command,
        aliases: [copy.command, copy.hint],
        defaults: {
          'web:macos': { code: 'KeyP', modifiers: ['primary', 'alt'] },
          'web:windows': { code: 'KeyP', modifiers: ['primary', 'alt'] },
          'desktop:macos': { code: 'KeyP', modifiers: ['primary', 'alt'] },
        },
        regions: ['page', 'editable'],
        modals: [],
        resolve() {
          return { status: 'handled', run: () => toggle() };
        },
      };
      scoped.effect(() => {
        const dispose = shortcuts.register(command);
        return () => {
          if (typeof dispose === 'function') dispose();
        };
      }, 'sidebar-panel-fold: shortcut');
    }

    /** Chord fallback for a build whose shortcut service is absent or rejected it. */
    function installKeyFallback(isRegistered) {
      const handler = (event) => {
        if (isRegistered()) return;
        if (!(event.altKey && (event.metaKey || event.ctrlKey))) return;
        if (event.shiftKey) return;
        if (event.code !== 'KeyP') return;
        const target = event.target;
        if (target instanceof Element && target.closest('.xterm') !== null) return;
        event.preventDefault();
        toggle();
      };
      window.addEventListener('keydown', handler, true);
      return () => window.removeEventListener('keydown', handler, true);
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        let registered = false;
        const isRegistered = () => registered;

        ctx.effect(() => installStyle(), 'sidebar-panel-fold: styles');

        ctx.effect(() => {
          paint();
          observer = new MutationObserver(schedule);
          observer.observe(document.body, { childList: true, subtree: true });
          window.addEventListener('resize', schedule);
          return () => {
            observer.disconnect();
            observer = null;
            window.removeEventListener('resize', schedule);
            if (rafHandle !== 0) {
              window.cancelAnimationFrame(rafHandle);
              rafHandle = 0;
            }
            const nav = navNode;
            navNode = null;
            if (nav !== null) nav.removeAttribute(FOLD_ATTR);
          };
        }, 'sidebar-panel-fold: host adaptation');

        ctx.effect(() => installKeyFallback(isRegistered), 'sidebar-panel-fold: key fallback');

        try {
          ctx.inject(['shortcuts'], (scoped) => {
            const shortcuts = typeof scoped.get === 'function' ? scoped.get('shortcuts') : null;
            if (!shortcuts || typeof shortcuts.register !== 'function') {
              console.warn('[sidebar-panel-fold] shortcut service unavailable; using the built-in chord');
              return;
            }
            try {
              registerShortcut(scoped);
              registered = true;
            } catch (error) {
              registered = false;
              console.warn('[sidebar-panel-fold] shortcut registration was refused; using the built-in chord', error);
            }
          });
        } catch (error) {
          console.warn('[sidebar-panel-fold] could not reach the shortcut service; using the built-in chord', error);
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'sidebar-panel-fold', order: -1000 },
            FoldHeader,
          ),
        );
      },
    };
  },
});

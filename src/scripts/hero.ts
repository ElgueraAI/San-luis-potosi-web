/** One owned reel plus manual regional photographs. Only the active clip loads.
 * No timer ever advances photographs. The poster remains usable on any failure. */
export function initHero(tier: string): void {
  const hero = document.querySelector<HTMLElement>('[data-hero-depth]');
  if (!hero || hero.hasAttribute('data-hero-ready')) return;
  const stage = hero.querySelector<HTMLElement>('[data-hero-stage]')!;
  const controls = hero.querySelector<HTMLElement>('[data-hero-controls]')!;
  const selectors = [...hero.querySelectorAll<HTMLButtonElement>('[data-hero-select]')];
  const places = [...hero.querySelectorAll<HTMLElement>('[data-hero-place]')];
  const credits = [...hero.querySelectorAll<HTMLDetailsElement>('[data-hero-credit]')];
  const toggle = hero.querySelector<HTMLButtonElement>('[data-hero-pause]')!;
  const toggleLabel = toggle.querySelector<HTMLElement>('[data-hero-pause-label]')!;
  const toggleIcon = toggle.querySelector<HTMLElement>('[data-hero-pause-icon]')!;
  const announce = hero.querySelector<HTMLElement>('[data-hero-announcement]')!;
  const message = hero.querySelector<HTMLElement>('[data-hero-media-message]')!;
  const status = hero.querySelector<HTMLElement>('[data-hero-video-status]')!;
  const progress = hero.querySelector<HTMLProgressElement>('[data-hero-progress]')!;
  const retry = hero.querySelector<HTMLButtonElement>('[data-hero-retry]')!;
  const format = hero.querySelector<HTMLElement>('[data-hero-format]')!;
  const reelScene = stage.querySelector<HTMLElement>('[data-hero-scene="reel"]');
  const reelPlace = hero.querySelector<HTMLElement>('[data-hero-reel-place]');
  const reelCredit = hero.querySelector<HTMLDetailsElement>('[data-hero-reel-credit]');
  const returnToReel = hero.querySelector<HTMLButtonElement>('[data-hero-return]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection as (Navigator['connection'] & Partial<EventTarget>);
  const initial = reelScene ? -1 : 0;
  const scenes = new Map<number, HTMLElement>([[initial, reelScene ?? stage.querySelector<HTMLElement>('[data-hero-scene="0"]')!]]);
  const interrupted = new WeakSet<HTMLVideoElement>();
  const resumeAfterPending = new WeakSet<HTMLVideoElement>();
  const playAttempts = new WeakMap<HTMLVideoElement, number>();
  const sourceLoads = new WeakMap<HTMLVideoElement, AbortController>();
  const loadTimers = new WeakMap<HTMLVideoElement, ReturnType<typeof setTimeout>>();
  let current = initial;
  let request = 0;
  let paused = false;
  let visible = hero.getBoundingClientRect().bottom > 0;
  const constrained = () => reduced.matches || !!connection?.saveData || tier !== 'full';
  const running = () => !paused && !constrained() && visible && !document.hidden;
  const activeScene = () => scenes.get(current)!;
  const activeVideo = () => activeScene().querySelector<HTMLVideoElement>('[data-hero-video]');
  const notify = (text: string) => { message.textContent = text; message.hidden = !text; };
  const pauseVideo = (video: HTMLVideoElement) => {
    if (video.hasAttribute('data-pending')) interrupted.add(video);
    video.pause();
    clearLoadTimer(video);
  };
  const clearLoadTimer = (video: HTMLVideoElement) => {
    clearTimeout(loadTimers.get(video));
    loadTimers.delete(video);
  };

  const unload = (scene: HTMLElement) => {
    const video = scene.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (!video) return;
    pauseVideo(video);
    sourceLoads.get(video)?.abort();
    sourceLoads.delete(video);
    clearLoadTimer(video);
    // Some browsers leave play() pending after every <source> fails.
    // Retire that attempt so a visitor can retry without waiting for it.
    playAttempts.set(video, (playAttempts.get(video) ?? 0) + 1);
    video.removeAttribute('data-pending');
    interrupted.delete(video);
    resumeAfterPending.delete(video);
    scene.removeAttribute('data-video-playing');
    if (video.hasAttribute('data-loaded')) {
      video.removeAttribute('data-loaded');
      video.querySelectorAll('source').forEach((source) => source.removeAttribute('src'));
      video.load();
    }
  };
  const failVideo = (scene: HTMLElement, blocked = false) => {
    scene.setAttribute('data-video-failed', '');
    unload(scene);
    if (scene !== activeScene()) return;
    hero.dataset.playback = 'error';
    retry.hidden = false;
    retry.textContent = blocked ? 'Reproducir video' : 'Reintentar video';
    toggle.hidden = true;
    notify(blocked ? 'El navegador pausó la reproducción automática. La fotografía sigue disponible.' : 'El video no pudo cargarse. Puedes seguir explorando con la fotografía.');
  };
  const bindVideo = (scene: HTMLElement) => {
    const video = scene.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (!video || video.hasAttribute('data-bound')) return;
    video.setAttribute('data-bound', '');
    video.addEventListener('error', () => { if (video.hasAttribute('data-loaded')) failVideo(scene); });
    video.addEventListener('waiting', () => { if (scene === activeScene()) notify('Cargando video…'); });
    video.addEventListener('playing', () => {
      if (scene !== activeScene() || !running()) { video.pause(); return; }
      clearLoadTimer(video);
      scene.setAttribute('data-video-playing', '');
      hero.dataset.playback = 'playing';
      notify('');
    });
    video.addEventListener('timeupdate', () => {
      if (scene === activeScene()) progress.value = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration * 100 : 0;
    });
  };
  const play = async (scene: HTMLElement) => {
    const video = scene.querySelector<HTMLVideoElement>('[data-hero-video]');
    if (!video || !running() || scene.hasAttribute('data-video-failed')) return;
    if (video.hasAttribute('data-pending')) {
      // A resume can arrive before pause/load has rejected the previous play.
      if (interrupted.has(video)) {
        resumeAfterPending.add(video);
        // A browser may never settle the interrupted play promise. Restoring
        // the deadline keeps that explicit resume recoverable as an error.
        if (!loadTimers.has(video)) {
          const attempt = playAttempts.get(video);
          loadTimers.set(video, setTimeout(() => {
            if (playAttempts.get(video) === attempt && scene === activeScene() && running()) failVideo(scene);
          }, 15000));
          hero.dataset.playback = 'loading';
          notify('Cargando video…');
        }
      }
      return;
    }
    if (!video.paused && scene.hasAttribute('data-video-playing')) return;
    interrupted.delete(video);
    resumeAfterPending.delete(video);
    bindVideo(scene);
    if (!video.hasAttribute('data-loaded')) {
      video.muted = true;
      const sources = [...video.querySelectorAll<HTMLSourceElement>('source[data-src]')].filter((source) => !source.dataset.media || matchMedia(source.dataset.media).matches);
      const controller = new AbortController();
      const failedSources = new Set<HTMLSourceElement>();
      sourceLoads.set(video, controller);
      sources.forEach((source) => {
        // Source errors do not bubble to <video>. Keep the browser's next
        // format available; only exhaustion of every active source is fatal.
        source.addEventListener('error', () => {
          if (controller.signal.aborted || !video.hasAttribute('data-loaded')) return;
          failedSources.add(source);
          if (failedSources.size === sources.length) failVideo(scene);
        }, { once: true, signal: controller.signal });
        source.src = source.dataset.src!;
      });
      video.setAttribute('data-loaded', '');
      notify('Cargando video…');
      video.load();
    }
    const attempt = (playAttempts.get(video) ?? 0) + 1;
    playAttempts.set(video, attempt);
    video.setAttribute('data-pending', '');
    clearLoadTimer(video);
    loadTimers.set(video, setTimeout(() => {
      if (playAttempts.get(video) === attempt && scene === activeScene() && running()) failVideo(scene);
    }, 15000));
    try {
      await video.play();
      if (playAttempts.get(video) !== attempt) return;
      if (scene !== activeScene() || !running()) video.pause();
    } catch (error: unknown) {
      if (playAttempts.get(video) !== attempt) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (scene === activeScene()) failVideo(scene, error instanceof DOMException && error.name === 'NotAllowedError');
    } finally {
      if (playAttempts.get(video) === attempt) {
        video.removeAttribute('data-pending');
        const resume = resumeAfterPending.has(video);
        resumeAfterPending.delete(video);
        interrupted.delete(video);
        // Consume one explicit resume request, never retry AbortError by itself.
        if (resume && scene === activeScene() && running() && video.paused && !scene.hasAttribute('data-video-failed')) void play(scene);
      }
    }
  };
  const sync = () => {
    const video = activeVideo();
    const manual = constrained();
    const failed = activeScene().hasAttribute('data-video-failed');
    status.hidden = !video;
    toggle.hidden = !video || manual || failed;
    retry.hidden = !video || manual || !failed;
    progress.hidden = !video || manual || failed;
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Reanudar video' : 'Pausar video');
    toggleLabel.textContent = paused ? 'Reanudar' : 'Pausar';
    toggleIcon.textContent = paused ? '▷' : 'Ⅱ';
    format.textContent = video && !manual ? 'San Luis Potosí en movimiento · Sin audio' : 'Paisajes de San Luis Potosí · Selección manual';
    if (returnToReel) returnToReel.hidden = current === -1 || manual;
    if (!video) { hero.dataset.playback = 'manual'; notify(''); return; }
    if (manual) { unload(activeScene()); hero.dataset.playback = 'manual'; notify('Fotografía estática para respetar tus preferencias de movimiento y datos.'); return; }
    if (!running()) { pauseVideo(video); hero.dataset.playback = 'paused'; return; }
    if (!failed) void play(activeScene());
  };
  const mount = (index: number) => {
    let scene = scenes.get(index);
    if (scene) return scene;
    const template = stage.querySelector<HTMLTemplateElement>(`[data-hero-template="${index}"]`)!;
    scene = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    stage.append(scene);
    scenes.set(index, scene);
    return scene;
  };
  const select = async (index: number) => {
    const token = ++request;
    if (index === current) { controls.removeAttribute('aria-busy'); return; }
    const scene = index === -1 ? reelScene! : mount(index);
    const image = scene.querySelector<HTMLImageElement>('img');
    controls.setAttribute('aria-busy', 'true');
    if (image) {
      image.loading = 'eager';
      try { await image.decode(); }
      catch {
        if (token !== request) return;
        announce.textContent = 'No se pudo cargar esa fotografía. Se conserva la región anterior.';
        controls.removeAttribute('aria-busy');
        return;
      }
    }
    if (token !== request) return;
    current = index;
    progress.value = 0;
    notify('');
    scenes.forEach((s, n) => { s.toggleAttribute('data-active', n === index); if (n !== index) unload(s); });
    selectors.forEach((s, n) => s.setAttribute('aria-pressed', String(n === index)));
    places.forEach((p, n) => { p.hidden = n !== index; });
    credits.forEach((c, n) => { c.hidden = n !== index; c.open = false; });
    if (reelPlace) reelPlace.hidden = index !== -1;
    if (reelCredit) { reelCredit.hidden = index !== -1; reelCredit.open = false; }
    hero.dataset.current = index === -1 ? 'reel' : String(index);
    const regionLabel = hero.querySelector<HTMLElement>('[data-hero-region-label]');
    if (regionLabel) regionLabel.textContent = index === -1 ? 'Regiones' : selectors[index].textContent?.trim() ?? 'Regiones';
    controls.removeAttribute('aria-busy');
    announce.textContent = index === -1 ? 'Video de San Luis Potosí. Sin audio.' : `${selectors[index].textContent?.trim()}. ${places[index].querySelector('h2')?.textContent}.`;
    sync();
  };
  selectors.forEach((button, index) => button.addEventListener('click', () => { void select(index); }));
  returnToReel?.addEventListener('click', () => { paused = false; void select(-1); });
  toggle.addEventListener('click', () => { paused = !paused; sync(); });
  retry.addEventListener('click', () => { activeScene().removeAttribute('data-video-failed'); paused = false; sync(); });
  const popovers = [...hero.querySelectorAll<HTMLDetailsElement>('.hero__region-menu, .hero__credit')];
  popovers.forEach((details) => details.addEventListener('toggle', () => {
    if (details.open) popovers.forEach((other) => { if (other !== details) other.open = false; });
  }));
  hero.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = popovers.find((details) => details.open);
    if (open) { event.preventDefault(); open.open = false; open.querySelector<HTMLElement>('summary')?.focus(); }
  });
  document.addEventListener('pointerdown', (event) => {
    popovers.forEach((details) => { if (details.open && !details.contains(event.target as Node)) details.open = false; });
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  connection?.addEventListener?.('change', sync);
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .15 }).observe(hero);
  addEventListener('pagehide', () => { scenes.forEach(unload); });
  hero.setAttribute('data-hero-ready', '');
  controls.inert = false;
  controls.removeAttribute('aria-hidden');
  sync();
}

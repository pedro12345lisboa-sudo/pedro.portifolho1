/* ============================================================
   Pedro Sites — script.js
   Versão: 2.0.0
   Autor: Pedro Sites
   Descrição: Frontend principal com autenticação Google,
              sistema de avaliações, portfólio dinâmico,
              animações, contadores e integração WhatsApp.
   ============================================================ */

"use strict";

/* ============================================================
   CONFIGURAÇÃO GLOBAL
   Centraliza todas as constantes do projeto em um único lugar.
   Altere aqui para refletir em toda a aplicação.
   ============================================================ */

const CONFIG = {
  /** URL do projeto Supabase */
  SUPABASE_URL: "https://arnxpuuzuccxnfgtqfib.supabase.co",

  /** Chave pública (anon) do Supabase — segura para uso no frontend */
  SUPABASE_ANON_KEY: "sb_publishable_rdBr6dW_wW9QULsh0HPtRg_qzQADXrp",

  /** Base da API: localhost em dev, /api em produção */
  API_BASE:
    window.location.hostname === "localhost"
      ? "http://localhost:3000/api"
      : "https://fortunate-possibility-production-3309.up.railway.app/api",

  /** Número WhatsApp no formato internacional sem + */
  WHATSAPP_NUMBER: "556199070566",

  /** Quantidade de avaliações carregadas por página */
  REVIEWS_PER_PAGE: 6,
};

/* ============================================================
   ESTADO GLOBAL
   Objeto mutável que representa o estado atual da aplicação.
   Não deve ser acessado diretamente fora de funções controladas.
   ============================================================ */

const STATE = {
  /** Instância do cliente Supabase (null até initAuth) */
  supabase: null,

  /** Sessão autenticada atual */
  session: null,

  /** Lista de avaliações carregadas */
  reviews: [],

  /** Página atual da paginação de avaliações */
  reviewsPage: 1,

  /** Total de avaliações no banco */
  reviewsTotal: 0,

  /** Flag para evitar requisições simultâneas */
  isLoadingReviews: false,

  /** Filtro ativo no portfólio (default: "all") */
  activeFilter: "all",

  /** Impede que os contadores animem mais de uma vez */
  countersAnimated: false,

  /** Nota selecionada no formulário de avaliação (1–5) */
  selectedRating: 0,
};

/* ============================================================
   UTILITÁRIOS GERAIS
   Funções puras, sem efeitos colaterais e reutilizáveis.
   ============================================================ */

/**
 * Atalho para document.querySelector com contexto opcional.
 * @param {string} sel - Seletor CSS
 * @param {Document|Element} ctx - Contexto de busca
 * @returns {Element|null}
 */
const $ = (sel, ctx = document) => ctx.querySelector(sel);

/**
 * Atalho para document.querySelectorAll retornando Array.
 * @param {string} sel - Seletor CSS
 * @param {Document|Element} ctx - Contexto de busca
 * @returns {Element[]}
 */
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/**
 * Cria uma versão com debounce de uma função.
 * Útil para eventos de scroll e resize.
 * @param {Function} fn - Função a ser atrasada
 * @param {number} delay - Milissegundos de espera
 * @returns {Function}
 */
function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Escapa HTML para evitar XSS ao inserir strings no DOM.
 * @param {string} str - Texto bruto
 * @returns {string} HTML seguro
 */
function sanitizeText(str) {
  const el = document.createElement("div");
  el.textContent = str;
  return el.innerHTML;
}

/**
 * Trunca uma string e adiciona reticências se necessário.
 * @param {string} str - Texto original
 * @param {number} max - Comprimento máximo permitido
 * @returns {string}
 */
function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trim() + "…" : str;
}

/**
 * Formata uma data ISO 8601 para o padrão pt-BR.
 * Ex: "2024-03-15T10:00:00Z" → "15 de mar. de 2024"
 * @param {string} iso - Data em formato ISO
 * @returns {string}
 */
function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Extrai as iniciais (máx. 2) de um nome completo.
 * Ex: "João da Silva" → "JS"
 * @param {string} name - Nome completo
 * @returns {string}
 */
function getInitials(name) {
  return (name || "U")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

/**
 * Constrói a URL do WhatsApp com mensagem pré-preenchida.
 * @param {string} message - Texto da mensagem
 * @returns {string}
 */
function buildWhatsappUrl(message) {
  return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/* ============================================================
   TOAST — SISTEMA DE NOTIFICAÇÕES
   Exibe mensagens temporárias no canto da tela.
   Suporta tipos: default | success | error
   ============================================================ */

const Toast = (() => {
  let timer;

  /**
   * Exibe uma notificação temporária na tela.
   * @param {string} message - Mensagem a ser exibida
   * @param {"default"|"success"|"error"} type - Tipo visual
   */
  function show(message, type = "default") {
    let node = $("#toast");

    if (!node) {
      node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }

    node.textContent = message;
    node.className = `toast toast--${type}`;
    requestAnimationFrame(() => node.classList.add("is-showing"));
    clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove("is-showing"), 3200);
  }

  return { show };
})();

/* ============================================================
   STAR RATING — SISTEMA DE ESTRELAS INTERATIVO
   Renderiza botões de 1 a 5 estrelas com hover e seleção.
   ============================================================ */

/**
 * Inicializa o input de estrelas no formulário de avaliação.
 * Configura clique, hover e saída do mouse.
 */
function initStarRating() {
  const container = $("#starRatingInput");
  if (!container) return;

  STATE.selectedRating = 5;
  renderStarInput(container, STATE.selectedRating);

  container.addEventListener("click", (e) => {
    const star = e.target.closest("[data-star]");
    if (!star) return;
    STATE.selectedRating = parseInt(star.dataset.star);
    renderStarInput(container, STATE.selectedRating);
  });

  container.addEventListener("mousemove", (e) => {
    const star = e.target.closest("[data-star]");
    if (!star) return;
    renderStarInput(container, parseInt(star.dataset.star), true);
  });

  container.addEventListener("mouseleave", () => {
    renderStarInput(container, STATE.selectedRating);
  });
}

/**
 * Renderiza os botões de estrela dentro do container.
 * @param {HTMLElement} container - Elemento pai
 * @param {number} active - Estrela ativa (1–5)
 * @param {boolean} hover - Indica estado de hover
 */
function renderStarInput(container, active, hover = false) {
  container.innerHTML = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    const filled = n <= active;
    return `
      <button
        type="button"
        data-star="${n}"
        class="star-btn${filled ? " filled" : ""}"
        aria-label="${n} estrela${n > 1 ? "s" : ""}"
      >
        <svg viewBox="0 0 24 24" width="28" height="28"
          fill="${filled ? "#facc15" : "none"}"
          stroke="${filled ? "#facc15" : "#4b5563"}"
          stroke-width="1.5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      </button>`;
  }).join("");
}

/**
 * Gera HTML de estrelas estáticas para exibição de avaliações.
 * @param {number} count - Nota (ex: 4.5)
 * @param {number} total - Total de estrelas (padrão: 5)
 * @returns {string} HTML das estrelas
 */
function renderStars(count, total = 5) {
  return Array.from({ length: total }, (_, i) => {
    const filled = i < Math.round(count);
    return `
      <svg class="reviews__star" viewBox="0 0 24 24"
        fill="${filled ? "#facc15" : "none"}"
        stroke="${filled ? "#facc15" : "#4b5563"}"
        stroke-width="1.5" aria-hidden="true">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>`;
  }).join("");
}

/* ============================================================
   AUTH — AUTENTICAÇÃO COM GOOGLE VIA SUPABASE
   Gerencia login/logout e atualização da UI conforme sessão.
   ============================================================ */

/**
 * Inicializa o cliente Supabase e configura listeners de auth.
 * Chama renderAuthUI após obter ou perder sessão.
 */
async function initAuth() {
  const supabaseLib = window.supabase;
  if (!supabaseLib?.createClient) {
    renderAuthUI(null);
    return;
  }

  STATE.supabase = supabaseLib.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "pedro_sites_auth",
      },
    },
  );

  const { data } = await STATE.supabase.auth.getSession();
  STATE.session = data?.session || null;
  renderAuthUI(STATE.session);

  STATE.supabase.auth.onAuthStateChange((event, session) => {
    STATE.session = session;
    renderAuthUI(session);
    if (event === "SIGNED_IN")
      Toast.show(`Bem-vindo, ${getDisplayName(session?.user)}! 👋`, "success");
    if (event === "SIGNED_OUT")
      Toast.show("Até logo! Sessão encerrada.", "default");
  });

  [$("#btnLoginGoogle"), $("#btnLoginGoogleFooter")]
    .filter(Boolean)
    .forEach((btn) => btn.addEventListener("click", () => handleAuthClick()));
}

/**
 * Alterna entre login e logout conforme estado atual.
 */
async function handleAuthClick() {
  if (!STATE.supabase) return;

  if (STATE.session?.user) {
    const badge = $("#userBadge");
    if (badge) badge.style.opacity = "0.5";
    await STATE.supabase.auth.signOut();
    if (badge) badge.style.opacity = "";
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await STATE.supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error) Toast.show("Não foi possível abrir o login com Google.", "error");
}

/**
 * Retorna o nome de exibição do usuário autenticado.
 * @param {object|null} user - Objeto do usuário Supabase
 * @returns {string}
 */
function getDisplayName(user) {
  const md = user?.user_metadata || {};
  return (
    md.full_name ||
    md.name ||
    md.user_name ||
    user?.email?.split("@")[0] ||
    "Usuário"
  );
}

/**
 * Atualiza todos os elementos de UI relacionados à autenticação.
 * @param {object|null} session - Sessão atual ou null
 */
function renderAuthUI(session) {
  const isLoggedIn = Boolean(session?.user);
  const user = session?.user;

  const badge      = $("#userBadge");
  const badgeDot   = $("#userBadgeDot");
  const badgeText  = $("#userBadgeText");

  badge?.classList.toggle("user-badge--logged", isLoggedIn);

  if (badgeDot)
    badgeDot.style.background = isLoggedIn
      ? "rgba(34,197,94,0.9)"
      : "rgba(148,163,184,0.55)";

  if (badgeText)
    badgeText.textContent = isLoggedIn
      ? truncate(getDisplayName(user), 20)
      : "Não autenticado";

  const avatarWrap     = $("#userAvatar");
  const avatarImg      = $("#userAvatarImg");
  const avatarFallback = $("#userAvatarFallback");

  if (avatarWrap) {
    avatarWrap.style.display = isLoggedIn ? "flex" : "none";
    avatarWrap.setAttribute("aria-hidden", isLoggedIn ? "false" : "true");
  }

  if (isLoggedIn && user) {
    const photoUrl =
      user.user_metadata?.avatar_url || user.user_metadata?.picture;

    if (avatarImg && photoUrl) {
      avatarImg.src = photoUrl;
      avatarImg.alt = `Foto de ${getDisplayName(user)}`;
      avatarImg.style.display = "block";
      if (avatarFallback) avatarFallback.style.display = "none";
    } else if (avatarFallback) {
      if (avatarImg) avatarImg.style.display = "none";
      avatarFallback.style.display = "flex";
      avatarFallback.textContent = getInitials(getDisplayName(user));
    }
  }

  [
    { btn: $("#btnLoginGoogle"),       label: $("#btnLoginLabel") },
    { btn: $("#btnLoginGoogleFooter"), label: $("#btnLoginGoogleFooter")?.querySelector(".btn__label") },
  ].forEach(({ btn, label }) => {
    if (!btn) return;
    btn.disabled = !STATE.supabase;
    if (label) label.textContent = isLoggedIn ? "Sair" : "Entrar";
    btn.setAttribute("aria-pressed", isLoggedIn ? "true" : "false");
    btn.style.transition = "opacity 200ms ease-out";
    btn.style.opacity = "0";
    requestAnimationFrame(() => { btn.style.opacity = "1"; });
  });
}

/* ============================================================
   AVALIAÇÕES — COMUNICAÇÃO COM A API
   ============================================================ */

/**
 * Busca avaliações paginadas da API.
 * @param {number} page - Página a buscar (começa em 1)
 * @returns {Promise<{reviews: object[], total: number, avgRating: number}>}
 */
async function fetchReviews(page = 1) {
  if (STATE.isLoadingReviews) return;
  STATE.isLoadingReviews = true;

  try {
    const offset = (page - 1) * CONFIG.REVIEWS_PER_PAGE;
    const url    = `${CONFIG.API_BASE}/reviews?limit=${CONFIG.REVIEWS_PER_PAGE}&offset=${offset}`;
    const res    = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Erro ao buscar avaliações");

    return {
      reviews:   data.reviews   || [],
      total:     data.total     || 0,
      avgRating: data.avgRating || 0,
    };
  } catch (err) {
    console.error("[Reviews] Erro ao buscar:", err);
    throw err;
  } finally {
    STATE.isLoadingReviews = false;
  }
}

/**
 * Envia uma nova avaliação para a API.
 * @param {{ name: string, message: string, rating: number }} payload
 */
async function submitReview(payload) {
  const res = await fetch(`${CONFIG.API_BASE}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok || !data.success)
    throw new Error(data.message || "Erro ao enviar avaliação");

  return data;
}

/* ============================================================
   AVALIAÇÕES — RENDERIZAÇÃO
   ============================================================ */

/**
 * Cria o elemento HTML de um item de avaliação.
 * @param {{ name: string, message: string, rating: number, createdAt: string }} review
 * @returns {HTMLElement}
 */
function renderReviewItem(review) {
  const article = document.createElement("article");
  article.className = "review";
  article.setAttribute("role", "listitem");

  const rating    = review.rating || 5;
  const starsHtml = renderStars(rating);

  article.innerHTML = `
    <div class="review__top">
      <span class="review__name">${sanitizeText(review.name)}</span>
      <span class="review__date">${formatDate(review.createdAt)}</span>
    </div>
    <div class="review__stars" aria-label="${rating} de 5 estrelas">
      ${starsHtml}
    </div>
    <p class="review__msg">${sanitizeText(review.message)}</p>
  `;

  return article;
}

/**
 * Carrega e renderiza avaliações da API.
 * @param {boolean} reset - Se true, limpa avaliações anteriores
 */
async function loadReviews(reset = false) {
  const list         = $("#reviewsList");
  const loadingEl    = $("#reviewsLoading");
  const layoutEl     = $("#reviewsLayout");
  const paginationEl = $("#reviewsPagination");

  if (!list) return;

  if (reset) {
    STATE.reviews     = [];
    STATE.reviewsPage = 1;
    list.innerHTML    = "";
  }

  if (STATE.reviewsPage === 1 && loadingEl) {
    loadingEl.style.display = "grid";
    if (layoutEl) layoutEl.style.display = "none";
  }

  try {
    const { reviews, total, avgRating } = await fetchReviews(STATE.reviewsPage);
    STATE.reviews      = [...STATE.reviews, ...reviews];
    STATE.reviewsTotal = total;

    const avgEl   = $("#reviewsAvgNum");
    const starsEl = $("#reviewsStars");
    const countEl = $("#reviewsAvgCount");

    if (total > 0) {
      const avg = avgRating || 5;
      if (avgEl)   avgEl.textContent   = avg.toFixed(1);
      if (countEl) countEl.textContent = `(${total} avaliação${total !== 1 ? "s" : ""})`;
      if (starsEl) starsEl.innerHTML   = renderStars(avg);
    }

    if (reviews.length === 0 && STATE.reviews.length === 0) {
      list.innerHTML = `<p class="review__empty">Nenhuma avaliação ainda. Seja o primeiro!</p>`;
    } else {
      reviews.forEach((r) => list.appendChild(renderReviewItem(r)));
    }

    const hasMore = STATE.reviews.length < total;
    if (paginationEl) paginationEl.style.display = hasMore ? "flex"  : "none";
    if (loadingEl)    loadingEl.style.display     = "none";
    if (layoutEl)     layoutEl.style.display      = "grid";

  } catch {
    if (loadingEl) loadingEl.style.display = "none";
    if (layoutEl)  layoutEl.style.display  = "grid";

    if (list.children.length === 0) {
      list.innerHTML = `
        <p class="review__empty" style="color:var(--text-danger)">
          Não foi possível carregar as avaliações.
        </p>`;
    }

    Toast.show("Erro ao carregar avaliações.", "error");
  }
}

/* ============================================================
   FORMULÁRIO DE AVALIAÇÃO
   ============================================================ */

/**
 * Inicializa o formulário de avaliação com validação em tempo real,
 * contador de caracteres, submissão assíncrona e paginação.
 */
function initReviewForm() {
  const form        = $("#reviewForm");
  const nameInput   = $("#reviewName");
  const msgInput    = $("#reviewMessage");
  const counter     = $("#reviewCounter");
  const submitBtn   = $("#btnSubmitReview");
  const nameError   = $("#reviewNameError");
  const msgError    = $("#reviewMessageError");
  const loadMoreBtn = $("#btnLoadMore");

  if (!form) return;

  initStarRating();

  if (msgInput && counter) {
    msgInput.addEventListener("input", () => {
      const len = msgInput.value.length;
      counter.textContent = `${len}/500`;
      counter.style.color = len > 450 ? "var(--text-warning)" : "";
    });
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
  }

  function clearError(el) {
    if (!el) return;
    el.textContent = "";
    el.classList.remove("is-visible");
  }

  /**
   * Valida um campo de texto com regras de tamanho.
   * @param {HTMLInputElement|HTMLTextAreaElement} input
   * @param {HTMLElement} errorEl
   * @param {number} minLen
   * @param {number} maxLen
   * @param {string} fieldName
   * @returns {boolean}
   */
  function validateField(input, errorEl, minLen, maxLen, fieldName) {
    const val = (input?.value || "").trim();
    if (!val) {
      showError(errorEl, `${fieldName} é obrigatório.`);
      input?.classList.add("is-error");
      return false;
    }
    if (val.length < minLen) {
      showError(errorEl, `${fieldName} deve ter pelo menos ${minLen} caracteres.`);
      input?.classList.add("is-error");
      return false;
    }
    if (val.length > maxLen) {
      showError(errorEl, `${fieldName} deve ter no máximo ${maxLen} caracteres.`);
      input?.classList.add("is-error");
      return false;
    }
    clearError(errorEl);
    input?.classList.remove("is-error");
    return true;
  }

  nameInput?.addEventListener("blur", () =>
    validateField(nameInput, nameError, 2, 80, "Nome"),
  );
  msgInput?.addEventListener("blur", () =>
    validateField(msgInput, msgError, 5, 500, "Mensagem"),
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const honeypot = form.querySelector('[name="website"]');
    if (honeypot?.value) return;

    const nameVal = (nameInput?.value || "").trim();
    const msgVal  = (msgInput?.value  || "").trim();

    const validName = validateField(nameInput, nameError, 2, 80, "Nome");
    const validMsg  = validateField(msgInput, msgError, 5, 500, "Mensagem");
    if (!validName || !validMsg) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
    }

    try {
      await submitReview({
        name:    nameVal,
        message: msgVal,
        rating:  STATE.selectedRating,
      });

      form.reset();
      STATE.selectedRating = 5;
      const starContainer = $("#starRatingInput");
      if (starContainer) renderStarInput(starContainer, 5);
      if (counter) counter.textContent = "0/500";
      clearError(nameError);
      clearError(msgError);
      Toast.show("Avaliação enviada! Obrigado 🙌", "success");
      await loadReviews(true);

    } catch (err) {
      Toast.show(err.message || "Erro ao enviar. Tente novamente.", "error");

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
      }
    }
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", async () => {
      STATE.reviewsPage++;
      loadMoreBtn.disabled    = true;
      loadMoreBtn.textContent = "Carregando...";
      await loadReviews();
      loadMoreBtn.disabled    = false;
      loadMoreBtn.textContent = "Carregar mais avaliações";
    });
  }
}

/* ============================================================
   NAVBAR — HEADER E NAVEGAÇÃO ATIVA
   ============================================================ */

/**
 * Inicializa o header flutuante e os links ativos por seção.
 */
function initNavbar() {
  const header   = $("[data-elevate]");
  const onScroll = debounce(() => {
    if (!header) return;
    header.classList.toggle("header--floating", window.scrollY > 20);
  }, 10);

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const sections = $$("section[id]");
  const navLinks = $$(".nav__link");

  if (sections.length && navLinks.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((a) => {
            const active = a.getAttribute("href") === `#${id}`;
            a.classList.toggle("is-active", active);
            a.setAttribute("aria-current", active ? "page" : "false");
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#']");
    if (!a) return;
    const hash = a.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = $(hash);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", hash);
    closeMobileMenu();
  });
}

/* ============================================================
   MENU MOBILE
   ============================================================ */

/**
 * Fecha o menu mobile e restaura o scroll da página.
 */
function closeMobileMenu() {
  const mobileNav = $("#mobileNav");
  const btnOpen   = $("#btnMenu");
  if (!mobileNav) return;
  mobileNav.classList.remove("is-open");
  mobileNav.setAttribute("aria-hidden", "true");
  btnOpen?.setAttribute("aria-expanded", "false");
  document.documentElement.style.overflow = "";
}

/**
 * Inicializa o menu mobile com todos os eventos de controle.
 */
function initMobileMenu() {
  const mobileNav = $("#mobileNav");
  const btnOpen   = $("#btnMenu");
  const btnClose  = $("#btnCloseMenu");
  const panel     = mobileNav?.querySelector(".mobile-nav__panel");

  function openMobileMenu() {
    if (!mobileNav) return;
    mobileNav.classList.add("is-open");
    mobileNav.setAttribute("aria-hidden", "false");
    btnOpen?.setAttribute("aria-expanded", "true");
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => panel?.focus(), 50);
  }

  window.closeMobileMenu = closeMobileMenu;

  btnOpen?.addEventListener("click", openMobileMenu);
  btnClose?.addEventListener("click", closeMobileMenu);
  mobileNav?.addEventListener("click", (e) => {
    if (!panel?.contains(e.target)) closeMobileMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });
}

/* ============================================================
   ANIMAÇÕES DE ENTRADA
   ============================================================ */

/**
 * Revela elementos [data-animate] ao entrar na viewport.
 * Respeita prefers-reduced-motion.
 */
function initAnimations() {
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!("IntersectionObserver" in window) || prefersReduced) {
    $$("[data-animate]").forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );

  $$("[data-animate]").forEach((el) => io.observe(el));
}

/* ============================================================
   CONTADORES ANIMADOS
   ============================================================ */

/**
 * Anima um número de 0 até target com easing ease-out cúbico.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration - ms (padrão 1800)
 */
function animateCounter(el, target, duration = 1800) {
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString("pt-BR");
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/**
 * Inicializa os contadores da seção de números.
 * Anima apenas uma vez quando a seção entra na viewport.
 */
function initCounters() {
  const stats = $$("[data-count]");
  if (!stats.length) return;

  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const io = new IntersectionObserver(
    (entries) => {
      if (STATE.countersAnimated) return;
      if (!entries.some((e) => e.isIntersecting)) return;
      STATE.countersAnimated = true;
      io.disconnect();
      stats.forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        prefersReduced
          ? (el.textContent = target.toLocaleString("pt-BR"))
          : animateCounter(el, target);
      });
    },
    { threshold: 0.4 },
  );

  const proofBar = $("#numeros") || $(".proof-bar");
  if (proofBar) io.observe(proofBar);
}

/* ============================================================
   FILTRO DE PORTFÓLIO
   ============================================================ */

/**
 * Inicializa os botões de filtro do portfólio.
 */
function initPortfolioFilter() {
  const filters = $$(".portfolio__filter");
  const grid    = $("#portfolioGrid");
  if (!filters.length || !grid) return;

  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      if (filter === STATE.activeFilter) return;
      STATE.activeFilter = filter;

      filters.forEach((f) => {
        f.classList.toggle("is-active", f === btn);
        f.setAttribute("aria-pressed", f === btn ? "true" : "false");
      });

      grid.classList.add("is-filtering");
      setTimeout(() => {
        $$(".card--portfolio", grid).forEach((item) => {
          item.classList.toggle(
            "portfolio__item--hidden",
            filter !== "all" && item.dataset.category !== filter,
          );
        });
        grid.classList.remove("is-filtering");
      }, 180);
    });
  });
}

/* ============================================================
   FAQ — ACORDEÃO
   ============================================================ */

/**
 * Inicializa o acordeão de FAQ com acessibilidade completa.
 */
function initFAQ() {
  $$(".faq__question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isExpanded = btn.getAttribute("aria-expanded") === "true";

      $$(".faq__question").forEach((other) => {
        if (other === btn) return;
        other.setAttribute("aria-expanded", "false");
        const otherId    = other.getAttribute("aria-controls");
        const otherAnswer = otherId ? $(`#${otherId}`) : null;
        if (otherAnswer) otherAnswer.hidden = true;
      });

      btn.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      const controlsId = btn.getAttribute("aria-controls");
      const answer     = controlsId ? $(`#${controlsId}`) : null;
      if (answer) answer.hidden = isExpanded;
    });
  });
}

/* ============================================================
   WHATSAPP
   ============================================================ */

/**
 * Inicializa o botão flutuante e o formulário de contato via WhatsApp.
 */
function initWhatsapp() {
  const baseMsg  = "Olá! Vim pelo site Pedro Sites e gostaria de um orçamento. Podemos conversar?";
  const floating = $("#whatsappFloat");
  if (floating) floating.href = buildWhatsappUrl(baseMsg);

  const btnSend = $("#btnSendContact");
  if (!btnSend) return;

  btnSend.addEventListener("click", () => {
    const name    = ($("#contactName")?.value    || "").trim();
    const email   = ($("#contactEmail")?.value   || "").trim();
    const phone   = ($("#contactPhone")?.value   || "").trim();
    const service = ($("#contactService")?.value || "").trim();
    const msg     = ($("#contactMsg")?.value     || "").trim();

    const serviceMap = {
      landing:       "Landing Page",
      institucional: "Site Institucional",
      manutencao:    "Manutenção",
      outro:         "Outro",
    };

    const parts = [
      "Olá! Vim pelo site Pedro Sites e gostaria de um orçamento.",
      "",
      name    ? `Nome: ${name}`                              : null,
      email   ? `E-mail: ${email}`                           : null,
      phone   ? `Telefone: ${phone}`                         : null,
      service ? `Serviço: ${serviceMap[service] || service}` : null,
      msg     ? `\nDetalhes:\n${msg}`                        : null,
      "",
      "Quando podemos conversar?",
    ]
      .filter((p) => p !== null)
      .join("\n");

    window.open(buildWhatsappUrl(parts), "_blank", "noopener,noreferrer");
  });
}

/* ============================================================
   BOTÃO VOLTAR AO TOPO
   ============================================================ */

/**
 * Inicializa o botão de voltar ao topo.
 */
function initBackToTop() {
  const btn = $("#btnToTop");
  if (!btn) return;

  const onScroll = debounce(
    () => btn.classList.toggle("is-visible", window.scrollY > 600),
    50,
  );

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  btn.addEventListener("click", () => {
    const home = $("#home");
    home
      ? home.scrollIntoView({ behavior: "smooth", block: "start" })
      : window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ============================================================
   HELPERS DE INICIALIZAÇÃO
   ============================================================ */

/** Define o ano atual no rodapé. */
function setYear() {
  const el = $("#year");
  if (el) el.textContent = new Date().getFullYear().toString();
}

/**
 * Lazy loading de imagens com IntersectionObserver.
 */
function initLazyImages() {
  if (!("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          delete img.dataset.src;
        }
        io.unobserve(img);
      });
    },
    { rootMargin: "200px 0px" },
  );

  $$("img[loading='lazy']").forEach((img) => io.observe(img));
}

/**
 * Define o link de navegação ativo pelo hash da URL.
 */
function setInitialActiveNav() {
  const hash = location.hash || "#home";
  const link = $(`.nav__link[href="${hash}"]`);
  if (link) {
    $$(".nav__link").forEach((a) => a.classList.remove("is-active"));
    link.classList.add("is-active");
  }
}

/**
 * Ativa scroll suave via CSS, respeitando prefers-reduced-motion.
 */
function initSmoothScroll() {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.style.scrollBehavior = "smooth";
  }
}

/**
 * Trap de foco no menu mobile para acessibilidade via teclado.
 */
function initKeyboardNav() {
  const mobileNav = $("#mobileNav");
  if (!mobileNav) return;

  mobileNav.addEventListener("keydown", (e) => {
    if (!mobileNav.classList.contains("is-open") || e.key !== "Tab") return;

    const focusables = $$("a, button, input, textarea, select, [tabindex]", mobileNav)
      .filter((el) => !el.disabled && el.tabIndex !== -1);

    if (!focusables.length) return;

    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/* ============================================================
   BOOTSTRAP — PONTO DE ENTRADA DA APLICAÇÃO
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  setYear();
  initSmoothScroll();
  setInitialActiveNav();
  initNavbar();
  initMobileMenu();
  initAnimations();
  initCounters();
  initPortfolioFilter();
  initFAQ();
  initWhatsapp();
  initBackToTop();
  initLazyImages();
  initKeyboardNav();
  initReviewForm();

  try { await initAuth(); } catch (err) { console.warn("[Auth] Falha:", err); renderAuthUI(null); }
  try { await loadReviews(true); } catch { /* tratado internamente */ }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  if (location.hostname === "localhost") {
    console.info("[PedroSites] App inicializado.");
    console.info("[PedroSites] API:", CONFIG.API_BASE);
  }
});

/* ============================================================
   API PÚBLICA
   ============================================================ */

window.PedroSites = {
  toast: Toast.show,
  buildWhatsappUrl,
};

/* ══════════════════════════════════════
   CALCULADORA DE ORÇAMENTO
   ══════════════════════════════════════ */
function initCalculadora() {
  const totalEl = document.getElementById("calcTotal");
  const ctaEl   = document.getElementById("calcCta");
  if (!totalEl) return;

  const state = { tipo: 497, paginas: 0 };
  const extras = {};

  function formatBRL(val) {
    return "R$ " + val.toLocaleString("pt-BR");
  }

  function recalc() {
    const base = (state.tipo || 0) + (state.paginas || 0);
    const extSum = Object.values(extras).reduce((a, b) => a + b, 0);
    const total = base + extSum;
    totalEl.textContent = formatBRL(total);
    if (ctaEl) {
      const plano = document.querySelector('#calcTipo .calc-opt--active')?.textContent?.trim().split(' ')[0] || '';
      ctaEl.href = "contato.html?plano=" + encodeURIComponent(plano) + "&valor=" + total;
    }
  }

  // Single-select groups
  document.querySelectorAll('#calcTipo .calc-opt, #calcPaginas .calc-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      btn.closest('.calc-options').querySelectorAll('.calc-opt').forEach(b => b.classList.remove('calc-opt--active'));
      btn.classList.add('calc-opt--active');
      state[key] = parseInt(btn.dataset.val) || 0;
      recalc();
    });
  });

  // Multi-select extras
  document.querySelectorAll('#calcExtras .calc-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      btn.classList.toggle('calc-opt--active');
      if (btn.classList.contains('calc-opt--active')) {
        extras[key] = parseInt(btn.dataset.val) || 0;
      } else {
        delete extras[key];
      }
      recalc();
    });
  });

  recalc();
}

document.addEventListener("DOMContentLoaded", initCalculadora);
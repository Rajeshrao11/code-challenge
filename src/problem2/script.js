(() => {
  const PRICES_URL = "https://interview.switcheo.com/prices.json";
  const ICON_BASE  = "https://raw.githubusercontent.com/Switcheo/token-icons/main/tokens/";

  // ---------- DOM ----------
  const form = document.getElementById("swap-form");

  const fromBtn = document.getElementById("from-token-btn");
  const toBtn   = document.getElementById("to-token-btn");

  const fromDD  = document.getElementById("from-dropdown");
  const toDD    = document.getElementById("to-dropdown");

  const fromIcon = document.getElementById("from-icon");
  const toIcon   = document.getElementById("to-icon");

  const fromCode = document.getElementById("from-code");
  const toCode   = document.getElementById("to-code");

  const inAmt  = document.getElementById("input-amount");
  const outAmt = document.getElementById("output-amount");

  const errIn  = document.getElementById("error-input");
  const errOut = document.getElementById("error-output");

  const usdFrom = document.getElementById("usd-from");
  const usdTo   = document.getElementById("usd-to");

  const rateLine = document.getElementById("rate-line");
  const feeLine  = document.getElementById("fee-line");

  const balFrom = document.getElementById("balance-from");
  const balTo   = document.getElementById("balance-to");

  const btnFlip = document.getElementById("btn-flip");
  const btnMax  = document.getElementById("btn-max");

  const btnSubmit = document.getElementById("btn-submit");
  const btnText   = document.getElementById("btn-text");
  const spinner   = document.getElementById("spinner");
  const pill      = document.getElementById("pill-status");

  const minReceivedEl = document.getElementById("min-received");
  const impactEl      = document.getElementById("price-impact");

  // ---------- State ----------
  let prices = [];                 // [{symbol, price}]
  let priceMap = new Map();        // symbol -> price
  let tokens = [];                 // symbols
  let fromToken = null;
  let toToken   = null;

  // mock balances (in token units)
  const balances = new Map();

  // slippage settings
  let slippagePct = 0.5; // default selected chip
  const FEE_RATE = 0.0025; // 0.25% mock fee

  // ---------- Helpers ----------
  const fmt = (n, dp = 6) => {
    if (!Number.isFinite(n)) return "—";
    // Trim trailing zeros nicely
    const s = n.toFixed(dp);
    return s.replace(/\.?0+$/,"");
  };

  const fmtUSD = (n) => {
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2
    }).format(n);
  };

  // Accepts "1", "1.", "1.23" but not "-1" or "1e6"
  const parseAmount = (raw) => {
    const v = String(raw).trim().replace(/,/g, "");
    if (v === "") return { ok: true, value: 0 };
    if (!/^\d*\.?\d*$/.test(v)) return { ok: false, value: NaN };
    const num = Number(v);
    if (!Number.isFinite(num)) return { ok: false, value: NaN };
    return { ok: true, value: num };
  };

  const getPrice = (sym) => priceMap.get(sym);

  const iconUrl = (sym) => `${ICON_BASE}${encodeURIComponent(sym)}.svg`;

  const setPill = (text, kind = "live") => {
    pill.textContent = text;
    pill.style.color =
      kind === "live" ? "rgba(255,255,255,.75)" :
      kind === "warn" ? "rgba(251,191,36,.95)" :
      kind === "bad"  ? "rgba(251,113,133,.95)" :
                        "rgba(255,255,255,.75)";
    pill.style.borderColor =
      kind === "live" ? "rgba(255,255,255,.14)" :
      kind === "warn" ? "rgba(251,191,36,.40)" :
      kind === "bad"  ? "rgba(251,113,133,.40)" :
                        "rgba(255,255,255,.14)";
    pill.style.background =
      kind === "live" ? "rgba(255,255,255,.06)" :
      kind === "warn" ? "rgba(251,191,36,.10)" :
      kind === "bad"  ? "rgba(251,113,133,.10)" :
                        "rgba(255,255,255,.06)";
  };

  const setLoading = (on) => {
    btnSubmit.disabled = on;
    spinner.style.display = on ? "inline-block" : "none";
    btnText.textContent = on ? "Swapping…" : "Confirm swap";
  };

  const closeDropdowns = () => {
    fromDD.style.display = "none";
    toDD.style.display = "none";
    fromBtn.setAttribute("aria-expanded", "false");
    toBtn.setAttribute("aria-expanded", "false");
  };

  const openDropdown = (dd, btn) => {
    closeDropdowns();
    dd.style.display = "block";
    btn.setAttribute("aria-expanded", "true");
    const search = dd.querySelector(".dd-search");
    if (search) search.focus();
  };

  const setTokenUI = (side, sym) => {
    const price = getPrice(sym);
    if (side === "from") {
      fromToken = sym;
      fromCode.textContent = sym;
      fromIcon.src = iconUrl(sym);
      fromIcon.alt = `${sym} icon`;
      balFrom.textContent = `Balance: ${fmt(balances.get(sym) || 0, 6)} ${sym}`;
      usdFrom.textContent = price ? `≈ ${fmtUSD(price * (parseAmount(inAmt.value).value || 0))}` : "≈ —";
    } else {
      toToken = sym;
      toCode.textContent = sym;
      toIcon.src = iconUrl(sym);
      toIcon.alt = `${sym} icon`;
      balTo.textContent = `Balance: ${fmt(balances.get(sym) || 0, 6)} ${sym}`;
      // usdTo updated in recalc()
    }
  };

  // ---------- Dropdown Rendering ----------
  const buildDropdown = (dd, currentSym, onPick) => {
    dd.innerHTML = `
      <div class="dd-head">
        <input class="dd-search" placeholder="Search token…" />
      </div>
      <div class="dd-list"></div>
    `;
    const search = dd.querySelector(".dd-search");
    const list = dd.querySelector(".dd-list");

    const renderList = (q = "") => {
      const query = q.trim().toLowerCase();
      const filtered = tokens
        .filter(sym => sym.toLowerCase().includes(query))
        .slice(0, 80);

      list.innerHTML = filtered.map(sym => {
        const p = getPrice(sym);
        const active = sym === currentSym;
        return `
          <div class="dd-item" role="option" aria-selected="${active}" data-sym="${sym}">
            <img class="token-icon" alt="" src="${iconUrl(sym)}" onerror="this.style.opacity='.35'"/>
            <strong>${sym}</strong>
            <small>${p ? fmtUSD(p) : ""}</small>
          </div>
        `;
      }).join("");

      // click handlers
      list.querySelectorAll(".dd-item").forEach(item => {
        item.addEventListener("click", () => {
          const sym = item.getAttribute("data-sym");
          onPick(sym);
          closeDropdowns();
        });
      });
    };

    renderList();

    search.addEventListener("input", () => renderList(search.value));

    // keyboard: escape closes
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdowns();
    });
  };

  // ---------- Calculation + Validation ----------
  const recalc = () => {
    errIn.textContent = "";
    errOut.textContent = "";

    if (!fromToken || !toToken) return;

    const pFrom = getPrice(fromToken);
    const pTo   = getPrice(toToken);

    if (!pFrom || !pTo) {
      outAmt.value = "";
      rateLine.textContent = "Rate: —";
      feeLine.textContent = "Fee: —";
      minReceivedEl.textContent = "—";
      impactEl.textContent = "—";
      usdFrom.textContent = "≈ —";
      usdTo.textContent = "≈ —";
      return;
    }

    const parsed = parseAmount(inAmt.value);
    if (!parsed.ok) {
      errIn.textContent = "Only numbers are allowed (e.g. 12.34).";
      outAmt.value = "";
      usdFrom.textContent = "≈ —";
      usdTo.textContent = "≈ —";
      rateLine.textContent = `Rate: 1 ${fromToken} ≈ ${fmt(pFrom / pTo, 6)} ${toToken}`;
      feeLine.textContent = `Fee: ${fmt(FEE_RATE * 100, 2)}%`;
      minReceivedEl.textContent = "—";
      impactEl.textContent = "—";
      btnSubmit.disabled = true;
      return;
    }

    const amountIn = parsed.value;

    // basic validation
    if (amountIn <= 0) {
      outAmt.value = "";
      usdFrom.textContent = "≈ —";
      usdTo.textContent = "≈ —";
      rateLine.textContent = `Rate: 1 ${fromToken} ≈ ${fmt(pFrom / pTo, 6)} ${toToken}`;
      feeLine.textContent = `Fee: ${fmt(FEE_RATE * 100, 2)}%`;
      minReceivedEl.textContent = "—";
      impactEl.textContent = "—";
      btnSubmit.disabled = true;
      return;
    }

    const bal = balances.get(fromToken) || 0;
    if (amountIn > bal + 1e-12) {
      errIn.textContent = `Insufficient balance. Max is ${fmt(bal, 6)} ${fromToken}.`;
      btnSubmit.disabled = true;
    } else {
      btnSubmit.disabled = false;
    }

    // compute
    const rate = pFrom / pTo; // 1 FROM => rate TO
    const feeAmountIn = amountIn * FEE_RATE;
    const amountInAfterFee = Math.max(0, amountIn - feeAmountIn);
    const amountOut = amountInAfterFee * rate;

    // display
    outAmt.value = fmt(amountOut, 8);

    const usdIn = amountIn * pFrom;
    const usdOut = amountOut * pTo; // should be ~usdIn minus fee
    usdFrom.textContent = `≈ ${fmtUSD(usdIn)}`;
    usdTo.textContent   = `≈ ${fmtUSD(usdOut)}`;

    rateLine.textContent = `Rate: 1 ${fromToken} ≈ ${fmt(rate, 6)} ${toToken}`;
    feeLine.textContent  = `Fee: ${fmt(feeAmountIn, 8)} ${fromToken} (${fmt(FEE_RATE * 100, 2)}%)`;

    const minReceived = amountOut * (1 - slippagePct / 100);
    minReceivedEl.textContent = `${fmt(minReceived, 8)} ${toToken}`;

    // mock price impact: based on trade size in USD
    // (purely to show UX; not real AMM math)
    const impact =
      usdIn < 50  ? 0.05 :
      usdIn < 250 ? 0.12 :
      usdIn < 1000? 0.35 :
                   0.80;
    impactEl.textContent = `${fmt(impact, 2)}%`;
  };

  // debounce typing
  let t = null;
  const scheduleRecalc = () => {
    clearTimeout(t);
    t = setTimeout(recalc, 120);
  };

  // ---------- Mock Balances ----------
  const seedBalances = () => {
    // make balances feel realistic
    tokens.forEach(sym => {
      const p = getPrice(sym);
      if (!p) return;
      // Give user around $200-$2000 worth of each, random-ish
      const usd = 200 + Math.random() * 1800;
      const amt = usd / p;
      balances.set(sym, Number(amt.toFixed(6)));
    });
  };

  // ---------- Actions ----------
  const flipTokens = () => {
    const oldFrom = fromToken;
    const oldTo = toToken;
    if (!oldFrom || !oldTo) return;

    setTokenUI("from", oldTo);
    setTokenUI("to", oldFrom);

    // Keep same input amount, just recalc output
    scheduleRecalc();
  };

  const setMax = () => {
    if (!fromToken) return;
    const bal = balances.get(fromToken) || 0;
    // leaving a tiny dust to avoid rounding issues
    const v = Math.max(0, bal - 0.000001);
    inAmt.value = fmt(v, 6);
    scheduleRecalc();
  };

  const simulateSubmit = async () => {
    // validate before submit
    recalc();
    if (btnSubmit.disabled) return;

    setLoading(true);
    setPill("Swapping…", "warn");

    // mock backend delay
    await new Promise(r => setTimeout(r, 1100));

    // "apply" balances
    const amtIn = parseAmount(inAmt.value).value || 0;
    const amtOut = Number(outAmt.value) || 0;

    const fromBal = balances.get(fromToken) || 0;
    const toBal = balances.get(toToken) || 0;

    balances.set(fromToken, Math.max(0, fromBal - amtIn));
    balances.set(toToken, toBal + amtOut);

    // UI update
    setTokenUI("from", fromToken);
    setTokenUI("to", toToken);

    // reset input
    inAmt.value = "";
    outAmt.value = "";

    usdFrom.textContent = "≈ —";
    usdTo.textContent = "≈ —";
    minReceivedEl.textContent = "—";
    impactEl.textContent = "—";
    feeLine.textContent = "Fee: —";

    setLoading(false);
    setPill("Success", "live");

    // little success feedback
    btnText.textContent = "Swap confirmed ✓";
    setTimeout(() => {
      btnText.textContent = "Confirm swap";
      setPill("Live", "live");
      recalc();
    }, 1200);
  };

  // ---------- Slippage Chips ----------
  const initChips = () => {
    const chips = Array.from(document.querySelectorAll(".chip"));
    chips.forEach(ch => {
      ch.addEventListener("click", () => {
        chips.forEach(c => c.classList.remove("active"));
        ch.classList.add("active");
        slippagePct = Number(ch.getAttribute("data-slip"));
        recalc();
      });
    });
  };

  // ---------- Event Wiring ----------
  fromBtn.addEventListener("click", () => openDropdown(fromDD, fromBtn));
  toBtn.addEventListener("click", () => openDropdown(toDD, toBtn));

  document.addEventListener("click", (e) => {
    const insideFrom = fromDD.contains(e.target) || fromBtn.contains(e.target);
    const insideTo   = toDD.contains(e.target)   || toBtn.contains(e.target);
    if (!insideFrom && !insideTo) closeDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdowns();
  });

  inAmt.addEventListener("input", scheduleRecalc);

  btnFlip.addEventListener("click", flipTokens);
  btnMax.addEventListener("click", setMax);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    simulateSubmit();
  });

  // ---------- Init ----------
  const init = async () => {
    setPill("Loading…", "warn");
    btnSubmit.disabled = true;

    try {
      const res = await fetch(PRICES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      prices = await res.json();

      // normalize: some feeds use uppercase symbols, keep as given
      prices = prices
        .filter(x => x && typeof x.currency === "string" && Number.isFinite(Number(x.price)))
        .map(x => ({ symbol: x.currency.trim(), price: Number(x.price) }))
        .filter(x => x.symbol && x.price > 0);

      priceMap = new Map(prices.map(p => [p.symbol, p.price]));
      tokens = Array.from(priceMap.keys()).sort((a,b) => a.localeCompare(b));

      if (tokens.length < 2) throw new Error("Not enough priced tokens.");

      seedBalances();

      // pick defaults that usually exist
      const pick = (preferred) => preferred.find(s => priceMap.has(s)) || tokens[0];
      const defFrom = pick(["USDC","USDT","SWTH","ETH","BTC","ATOM","BNB"]);
      const defTo   = pick(["SWTH","ETH","USDC","USDT","ATOM","BTC","BNB"].filter(x => x !== defFrom));

      // build dropdowns
      buildDropdown(fromDD, defFrom, (sym) => {
        if (sym === toToken) {
          // prevent same token on both sides: auto flip
          setTokenUI("to", fromToken);
        }
        setTokenUI("from", sym);
        buildDropdown(fromDD, fromToken, (s) => {
          if (s === toToken) setTokenUI("to", fromToken);
          setTokenUI("from", s);
          scheduleRecalc();
        });
        scheduleRecalc();
      });

      buildDropdown(toDD, defTo, (sym) => {
        if (sym === fromToken) {
          setTokenUI("from", toToken);
        }
        setTokenUI("to", sym);
        buildDropdown(toDD, toToken, (s) => {
          if (s === fromToken) setTokenUI("from", toToken);
          setTokenUI("to", s);
          scheduleRecalc();
        });
        scheduleRecalc();
      });

      setTokenUI("from", defFrom);
      setTokenUI("to", defTo);

      initChips();
      recalc();

      setPill("Live", "live");
      btnSubmit.disabled = true; // until user enters amount
    } catch (err) {
      console.error(err);
      setPill("Offline", "bad");
      errIn.textContent = "Failed to load live prices. Please refresh and try again.";
      btnSubmit.disabled = true;
    }
  };

  init();
})();

/* ============================================
   JL Delícias em Camadas — Application Logic
   ============================================ */

(function () {
  'use strict';

  // ========== STORAGE KEYS ==========
  const STORAGE_KEY = 'jlDelicias';
  const OLD_STORAGE_KEY = 'fichaTecnicaJL';

  // ========== DATA STRUCTURE ==========
  function getDefaultData() {
    return {
      receitas: [],
      historicoPrecos: {},
      configuracoes: {
        despesasPadrao: {
          Aluguel: '', Energia: '', 'Água': '',
          Internet: '', 'Escritório': '', Mei: ''
        },
        maoObraPadrao: { salario: '', dias: '', horas: '' }
      }
    };
  }

  // ========== STATE ==========
  let appData = getDefaultData();
  let currentEditId = null;
  let confirmCallback = null;

  // ========== UTILITIES ==========
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return 'R$ ' + num.toFixed(2).replace('.', ',');
  }

  function parseCurrency(str) {
    if (typeof str === 'number') return str;
    return parseFloat(String(str).replace('R$', '').replace(/\s/g, '').replace(',', '.')) || 0;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  }

  function normalizeIngredientName(name) {
    return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ========== STORAGE ==========
  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
      showToast('Erro ao salvar dados. O armazenamento pode estar cheio.', 'error');
    }
  }

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        appData = Object.assign(getDefaultData(), parsed);
        if (!Array.isArray(appData.receitas)) appData.receitas = [];
        if (!appData.historicoPrecos) appData.historicoPrecos = {};
        if (!appData.configuracoes) appData.configuracoes = getDefaultData().configuracoes;
      } catch (e) {
        appData = getDefaultData();
      }
    } else {
      migrateOldData();
    }
  }

  function migrateOldData() {
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldRaw) return;

    try {
      const old = JSON.parse(oldRaw);
      const recipe = {
        id: generateId(),
        nome: 'Receita Importada',
        descricao: 'Receita migrada do sistema anterior',
        categoria: 'Outros',
        foto: '',
        rendimento: parseFloat(old.outros?.rendimento) || 0,
        tempoPreparo: parseFloat(old.outros?.tempoPreparo) || 0,
        margemLucro: parseFloat(old.outros?.lucro) || 0,
        ingredientes: [],
        maoObra: {
          salario: parseFloat(old.maoObra?.salario) || 0,
          dias: parseFloat(old.maoObra?.dias) || 22,
          horas: parseFloat(old.maoObra?.horas) || 8
        },
        despesas: {},
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString()
      };

      if (old.ingredientes && Array.isArray(old.ingredientes)) {
        recipe.ingredientes = old.ingredientes.map(ing => ({
          nome: ing.nome || '',
          pesoEmbalagem: parseFloat(ing.peso) || 0,
          quantidadeUtilizada: parseFloat(ing.quantidade) || 0,
          custoEmbalagem: parseFloat(ing.custo) || 0
        }));
      }

      if (old.despesas) {
        recipe.despesas = {};
        Object.keys(old.despesas).forEach(key => {
          recipe.despesas[key] = parseFloat(old.despesas[key]) || 0;
        });
      }

      // Recalculate
      recalculateRecipe(recipe);
      appData.receitas.push(recipe);

      // Register ingredient prices
      recipe.ingredientes.forEach(ing => {
        if (ing.nome) registerPrice(ing.nome, ing.custoEmbalagem, recipe.nome);
      });

      saveData();
      showToast('Dados do sistema anterior foram importados com sucesso!', 'success');
    } catch (e) {
      console.error('Migration error:', e);
    }
  }

  // ========== CALCULATIONS (preserved logic) ==========
  function calcIngredientCost(ing) {
    const peso = parseFloat(ing.pesoEmbalagem) || 0;
    const qtd = parseFloat(ing.quantidadeUtilizada) || 0;
    const custo = parseFloat(ing.custoEmbalagem) || 0;
    return peso > 0 ? (qtd / peso) * custo : 0;
  }

  function recalculateRecipe(recipe) {
    let totalIngredientes = 0;
    recipe.ingredientes.forEach(ing => {
      ing.custoUtilizado = calcIngredientCost(ing);
      totalIngredientes += ing.custoUtilizado;
    });

    const salario = parseFloat(recipe.maoObra?.salario) || 0;
    const dias = parseFloat(recipe.maoObra?.dias) || 1;
    const horas = parseFloat(recipe.maoObra?.horas) || 1;
    const horasMes = dias * horas;
    const custoHora = horasMes > 0 ? salario / horasMes : 0;
    const tempoPreparo = parseFloat(recipe.tempoPreparo) || 0;
    const custoMaoObra = (tempoPreparo / 60) * custoHora;

    let totalDespesas = 0;
    if (recipe.despesas) {
      Object.values(recipe.despesas).forEach(v => { totalDespesas += parseFloat(v) || 0; });
    }
    const despesaRateada = totalDespesas / 30;

    const custoTotal = totalIngredientes + custoMaoObra + despesaRateada;
    const margem = parseFloat(recipe.margemLucro) || 0;
    const precoSugerido = custoTotal * (1 + margem / 100);
    const rendimento = parseFloat(recipe.rendimento) || 1;
    const custoPorUnidade = custoTotal / rendimento;
    const precoPorUnidade = precoSugerido / rendimento;

    recipe.custoIngredientes = totalIngredientes;
    recipe.custoMaoObra = custoMaoObra;
    recipe.custoDespesas = despesaRateada;
    recipe.custoTotal = custoTotal;
    recipe.precoSugerido = precoSugerido;
    recipe.custoPorUnidade = custoPorUnidade;
    recipe.precoPorUnidade = precoPorUnidade;
    recipe.valorHora = custoHora;

    return recipe;
  }

  // ========== PRICE HISTORY ==========
  function registerPrice(ingredientName, price, recipeName) {
    const key = normalizeIngredientName(ingredientName);
    if (!key || !price) return;
    if (!appData.historicoPrecos[key]) {
      appData.historicoPrecos[key] = {
        nome: ingredientName.trim(),
        entradas: []
      };
    }
    appData.historicoPrecos[key].entradas.push({
      preco: parseFloat(price),
      data: new Date().toISOString(),
      receita: recipeName
    });
  }

  function getPriceAlerts() {
    const alerts = [];
    const history = appData.historicoPrecos;

    Object.keys(history).forEach(key => {
      const item = history[key];
      if (item.entradas.length < 2) return;
      const sorted = [...item.entradas].sort((a, b) => new Date(b.data) - new Date(a.data));
      const latest = sorted[0];
      const previous = sorted[1];
      if (latest.preco !== previous.preco) {
        const diff = latest.preco - previous.preco;
        const pct = previous.preco > 0 ? (diff / previous.preco) * 100 : 0;
        alerts.push({
          nome: item.nome,
          precoAnterior: previous.preco,
          precoAtual: latest.preco,
          diferenca: diff,
          percentual: pct,
          receitaAnterior: previous.receita,
          receitaAtual: latest.receita
        });
      }
    });

    return alerts;
  }

  function getRecipePriceAlerts(recipe) {
    const alerts = [];
    const history = appData.historicoPrecos;

    recipe.ingredientes.forEach(ing => {
      if (!ing.nome) return;
      const key = normalizeIngredientName(ing.nome);
      const item = history[key];
      if (!item || item.entradas.length < 1) return;

      const sorted = [...item.entradas].sort((a, b) => new Date(b.data) - new Date(a.data));
      const latest = sorted[0];
      const recipePrice = parseFloat(ing.custoEmbalagem) || 0;

      if (Math.abs(latest.preco - recipePrice) > 0.01) {
        const diff = latest.preco - recipePrice;
        const pct = recipePrice > 0 ? (diff / recipePrice) * 100 : 0;
        alerts.push({
          nome: ing.nome,
          precoReceita: recipePrice,
          precoRecente: latest.preco,
          diferenca: diff,
          percentual: pct
        });
      }
    });

    return alerts;
  }

  // ========== TOAST ==========
  function showToast(msg, type) {
    type = type || 'success';
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
    toast.innerHTML = '<span>' + icon + '</span> ' + escapeHtml(msg);
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3200);
  }

  // ========== CONFIRM MODAL ==========
  function showConfirm(title, msg, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmModal').classList.add('show');
    confirmCallback = callback;
  }

  function hideConfirm() {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
  }

  // ========== NAVIGATION ==========
  function navigateTo(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById('page-' + pageName);
    if (page) {
      page.classList.remove('hidden');
      // Force re-animation
      page.style.animation = 'none';
      page.offsetHeight; // reflow
      page.style.animation = '';
    }

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector('[data-page="' + pageName + '"]');
    if (navItem) navItem.classList.add('active');

    // Close mobile menu
    closeMobileMenu();

    // Render page content
    switch (pageName) {
      case 'dashboard': renderDashboard(); break;
      case 'recipes': renderRecipesList(); break;
      case 'new-recipe': prepareNewRecipe(); break;
      case 'price-compare': renderPriceCompare(); break;
      case 'settings': renderSettings(); break;
    }

    window.scrollTo(0, 0);
  }

  // ========== MOBILE MENU ==========
  function openMobileMenu() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
  }

  function closeMobileMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  }

  // ========== DASHBOARD ==========
  function renderDashboard() {
    const recipes = appData.receitas;
    const count = recipes.length;

    document.getElementById('statRecipes').textContent = count;

    if (count > 0) {
      const sorted = [...recipes].sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao) - new Date(a.dataAtualizacao || a.dataCriacao));
      document.getElementById('statLastRecipe').textContent = sorted[0].nome || '—';

      const totalCost = recipes.reduce((sum, r) => sum + (r.custoTotal || 0), 0);
      document.getElementById('statAvgCost').textContent = formatCurrency(totalCost / count);
    } else {
      document.getElementById('statLastRecipe').textContent = '—';
      document.getElementById('statAvgCost').textContent = 'R$ 0,00';
    }

    // Alerts
    const alerts = getPriceAlerts();
    document.getElementById('statAlerts').textContent = alerts.length;

    const alertsContainer = document.getElementById('dashAlerts');
    const alertsList = document.getElementById('dashAlertsList');
    if (alerts.length > 0) {
      alertsContainer.style.display = '';
      alertsList.innerHTML = alerts.map(a => renderAlertItem(a)).join('');
    } else {
      alertsContainer.style.display = 'none';
    }

    // Recent recipes
    const recentContainer = document.getElementById('recentRecipes');
    if (count > 0) {
      const recent = [...recipes]
        .sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao) - new Date(a.dataAtualizacao || a.dataCriacao))
        .slice(0, 6);
      recentContainer.innerHTML = recent.map(r => renderRecipeCard(r)).join('');
      attachCardEvents(recentContainer);
    } else {
      recentContainer.innerHTML = '<div class="empty-state"><div class="empty-illustration"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><path d="M2 21a8 8 0 0 1 11.873-7"/><circle cx="10" cy="8" r="5"/><path d="M22 16c0 3-2 4-4 4s-4-1-4-4c0-2 2-8 4-8s4 6 4 8Z"/></svg></div><h3>Nenhuma receita ainda</h3><p>Clique em "Nova Receita" para começar!</p></div>';
    }
  }

  function renderAlertItem(alert) {
    const isIncrease = alert.diferenca > 0;
    const cls = isIncrease ? 'alert-increase' : 'alert-decrease';
    const sign = isIncrease ? '+' : '';
    return '<div class="alert-item">' +
      '<span class="alert-item-name">' + escapeHtml(alert.nome) + '</span>' +
      '<span class="alert-item-change">' + formatCurrency(alert.precoAnterior) + ' → ' + formatCurrency(alert.precoAtual) + '</span>' +
      '<span class="alert-item-pct ' + cls + '">' + sign + alert.percentual.toFixed(2) + '%</span>' +
      '</div>';
  }

  // ========== RECIPES LIST ==========
  function renderRecipesList() {
    const container = document.getElementById('recipesGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchRecipes');
    const activeFilter = document.querySelector('.filter-tag.active')?.dataset.filter || 'all';

    let filtered = appData.receitas;
    const search = (searchInput.value || '').trim().toLowerCase();

    if (search) {
      filtered = filtered.filter(r => r.nome.toLowerCase().includes(search));
    }

    if (activeFilter !== 'all') {
      filtered = filtered.filter(r => r.categoria === activeFilter);
    }

    if (appData.receitas.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Nenhuma receita encontrada</h3><p>Tente alterar os filtros ou o termo de busca.</p></div>';
      return;
    }

    const sorted = [...filtered].sort((a, b) => new Date(b.dataAtualizacao || b.dataCriacao) - new Date(a.dataAtualizacao || a.dataCriacao));
    container.innerHTML = sorted.map(r => renderRecipeCard(r)).join('');
    attachCardEvents(container);
  }

  function renderRecipeCard(recipe) {
    recalculateRecipe(recipe);
    const photoHtml = recipe.foto
      ? '<div class="recipe-card-photo"><img src="' + recipe.foto + '" alt="' + escapeHtml(recipe.nome) + '"></div>'
      : '<div class="recipe-card-photo-placeholder"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';

    return '<div class="recipe-card" data-id="' + recipe.id + '">' +
      photoHtml +
      '<div class="recipe-card-body">' +
        (recipe.categoria ? '<span class="recipe-card-category">' + escapeHtml(recipe.categoria) + '</span>' : '') +
        '<h3 class="recipe-card-name">' + escapeHtml(recipe.nome) + '</h3>' +
        '<div class="recipe-card-details">' +
          '<span>Rendimento: <strong>' + (recipe.rendimento || '—') + ' unid.</strong></span>' +
          '<span>Custo: <strong>' + formatCurrency(recipe.custoTotal) + '</strong></span>' +
          '<span>Preço sugerido: <strong>' + formatCurrency(recipe.precoSugerido) + '</strong></span>' +
          (recipe.margemLucro ? '<span>Margem: <strong>' + recipe.margemLucro + '%</strong></span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="recipe-card-footer">' +
        '<span class="recipe-card-date">' + formatDate(recipe.dataAtualizacao || recipe.dataCriacao) + '</span>' +
        '<div class="recipe-card-menu">' +
          '<button class="recipe-card-menu-btn" data-menu="' + recipe.id + '">⋮</button>' +
          '<div class="recipe-card-dropdown" id="dropdown-' + recipe.id + '">' +
            '<button data-action="view" data-id="' + recipe.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Abrir</button>' +
            '<button data-action="edit" data-id="' + recipe.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg> Editar</button>' +
            '<button data-action="duplicate" data-id="' + recipe.id + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Duplicar</button>' +
            '<button data-action="delete" data-id="' + recipe.id + '" class="danger"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Excluir</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function attachCardEvents(container) {
    // Card click -> view
    container.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.recipe-card-menu') || e.target.closest('.recipe-card-dropdown')) return;
        const id = this.dataset.id;
        viewRecipe(id);
      });
    });

    // Menu toggle
    container.querySelectorAll('.recipe-card-menu-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const menuId = this.dataset.menu;
        closeAllDropdowns();
        const dd = document.getElementById('dropdown-' + menuId);
        if (dd) dd.classList.toggle('show');
      });
    });

    // Dropdown actions
    container.querySelectorAll('.recipe-card-dropdown button').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const action = this.dataset.action;
        const id = this.dataset.id;
        closeAllDropdowns();
        switch (action) {
          case 'view': viewRecipe(id); break;
          case 'edit': editRecipe(id); break;
          case 'duplicate': duplicateRecipe(id); break;
          case 'delete': deleteRecipe(id); break;
        }
      });
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.recipe-card-dropdown').forEach(d => d.classList.remove('show'));
  }

  // ========== NEW RECIPE ==========
  function prepareNewRecipe() {
    if (currentEditId) return; // already in edit mode
    clearRecipeForm();
    document.getElementById('recipeFormTitle').textContent = 'Nova Receita';
    document.getElementById('recipeFormSubtitle').textContent = 'Preencha os dados da ficha técnica';
    currentEditId = null;

    // Load defaults
    const cfg = appData.configuracoes;
    if (cfg.despesasPadrao) {
      document.querySelectorAll('.despesa-input').forEach(input => {
        const nome = input.dataset.nome;
        if (cfg.despesasPadrao[nome]) input.value = cfg.despesasPadrao[nome];
      });
    }
    if (cfg.maoObraPadrao) {
      if (cfg.maoObraPadrao.salario) document.getElementById('recSalario').value = cfg.maoObraPadrao.salario;
      if (cfg.maoObraPadrao.dias) document.getElementById('recDias').value = cfg.maoObraPadrao.dias;
      if (cfg.maoObraPadrao.horas) document.getElementById('recHoras').value = cfg.maoObraPadrao.horas;
    }

    updateFormCalculations();
    document.getElementById('recipePriceAlerts').style.display = 'none';
  }

  function clearRecipeForm() {
    document.getElementById('recipeName').value = '';
    document.getElementById('recipeDesc').value = '';
    document.getElementById('recipeCategory').value = '';
    document.getElementById('recipeYield').value = '';
    document.getElementById('recipePrepTime').value = '';
    document.getElementById('recipeMargin').value = '0';
    document.getElementById('recSalario').value = '';
    document.getElementById('recDias').value = '';
    document.getElementById('recHoras').value = '';
    document.querySelectorAll('.despesa-input').forEach(input => { input.value = ''; });
    document.getElementById('ingredientsBody').innerHTML = '';
    document.getElementById('ingredientsEmpty').style.display = '';

    // Photo
    const preview = document.getElementById('photoPreview');
    preview.classList.remove('has-photo');
    const existingImg = preview.querySelector('img');
    if (existingImg) existingImg.remove();
    preview.querySelector('svg').style.display = '';
    preview.querySelector('span').style.display = '';
    document.getElementById('photoInput').value = '';

    currentEditId = null;
  }

  function editRecipe(id) {
    const recipe = appData.receitas.find(r => r.id === id);
    if (!recipe) return;

    navigateTo('new-recipe');
    currentEditId = id;

    document.getElementById('recipeFormTitle').textContent = 'Editar Receita';
    document.getElementById('recipeFormSubtitle').textContent = recipe.nome;

    document.getElementById('recipeName').value = recipe.nome || '';
    document.getElementById('recipeDesc').value = recipe.descricao || '';
    document.getElementById('recipeCategory').value = recipe.categoria || '';
    document.getElementById('recipeYield').value = recipe.rendimento || '';
    document.getElementById('recipePrepTime').value = recipe.tempoPreparo || '';
    document.getElementById('recipeMargin').value = recipe.margemLucro || '0';
    document.getElementById('recSalario').value = recipe.maoObra?.salario || '';
    document.getElementById('recDias').value = recipe.maoObra?.dias || '';
    document.getElementById('recHoras').value = recipe.maoObra?.horas || '';

    // Despesas
    document.querySelectorAll('.despesa-input').forEach(input => {
      const nome = input.dataset.nome;
      input.value = recipe.despesas?.[nome] || '';
    });

    // Photo
    if (recipe.foto) {
      setPhotoPreview(recipe.foto);
    }

    // Ingredients
    document.getElementById('ingredientsBody').innerHTML = '';
    if (recipe.ingredientes && recipe.ingredientes.length > 0) {
      document.getElementById('ingredientsEmpty').style.display = 'none';
      recipe.ingredientes.forEach(ing => addIngredientRow(ing));
    } else {
      document.getElementById('ingredientsEmpty').style.display = '';
    }

    updateFormCalculations();

    // Price alerts
    const alerts = getRecipePriceAlerts(recipe);
    renderRecipePriceAlerts(alerts);
  }

  function saveRecipe() {
    const name = document.getElementById('recipeName').value.trim();
    if (!name) {
      showToast('Informe o nome da receita.', 'error');
      document.getElementById('recipeName').focus();
      return;
    }

    const recipe = {
      id: currentEditId || generateId(),
      nome: name,
      descricao: document.getElementById('recipeDesc').value.trim(),
      categoria: document.getElementById('recipeCategory').value,
      rendimento: parseFloat(document.getElementById('recipeYield').value) || 0,
      tempoPreparo: parseFloat(document.getElementById('recipePrepTime').value) || 0,
      margemLucro: parseFloat(document.getElementById('recipeMargin').value) || 0,
      foto: getPhotoData(),
      ingredientes: collectIngredients(),
      maoObra: {
        salario: parseFloat(document.getElementById('recSalario').value) || 0,
        dias: parseFloat(document.getElementById('recDias').value) || 1,
        horas: parseFloat(document.getElementById('recHoras').value) || 1
      },
      despesas: {},
      dataCriacao: currentEditId
        ? (appData.receitas.find(r => r.id === currentEditId)?.dataCriacao || new Date().toISOString())
        : new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };

    document.querySelectorAll('.despesa-input').forEach(input => {
      recipe.despesas[input.dataset.nome] = parseFloat(input.value) || 0;
    });

    recalculateRecipe(recipe);

    // Register ingredient prices in history
    recipe.ingredientes.forEach(ing => {
      if (ing.nome && ing.custoEmbalagem) {
        registerPrice(ing.nome, ing.custoEmbalagem, recipe.nome);
      }
    });

    if (currentEditId) {
      const idx = appData.receitas.findIndex(r => r.id === currentEditId);
      if (idx !== -1) appData.receitas[idx] = recipe;
    } else {
      appData.receitas.push(recipe);
    }

    saveData();
    showToast('Receita salva com sucesso!', 'success');
    currentEditId = null;
    navigateTo('recipes');
  }

  function collectIngredients() {
    const rows = document.querySelectorAll('#ingredientsBody tr');
    const ingredients = [];
    rows.forEach(tr => {
      ingredients.push({
        nome: tr.querySelector('.ing-nome')?.value || '',
        pesoEmbalagem: parseFloat(tr.querySelector('.ing-peso')?.value) || 0,
        quantidadeUtilizada: parseFloat(tr.querySelector('.ing-qtd')?.value) || 0,
        custoEmbalagem: parseFloat(tr.querySelector('.ing-custo')?.value) || 0
      });
    });
    return ingredients;
  }

  function getPhotoData() {
    const preview = document.getElementById('photoPreview');
    const img = preview.querySelector('img');
    return img ? img.src : '';
  }

  function setPhotoPreview(src) {
    const preview = document.getElementById('photoPreview');
    preview.classList.add('has-photo');
    let img = preview.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      preview.appendChild(img);
    }
    img.src = src;
    preview.querySelector('svg').style.display = 'none';
    preview.querySelector('span').style.display = 'none';
  }

  // ========== INGREDIENT ROWS ==========
  function addIngredientRow(data) {
    data = data || {};
    const tbody = document.getElementById('ingredientsBody');
    document.getElementById('ingredientsEmpty').style.display = 'none';

    const tr = document.createElement('tr');
    const cost = calcIngredientCost(data);

    tr.innerHTML =
      '<td><input type="text" class="ing-nome" placeholder="Ex: Farinha" value="' + escapeHtml(data.nome || '') + '"></td>' +
      '<td><input type="number" class="ing-peso" min="0" step="any" placeholder="1000" value="' + (data.pesoEmbalagem || '') + '"></td>' +
      '<td><input type="number" class="ing-qtd" min="0" step="any" placeholder="200" value="' + (data.quantidadeUtilizada || '') + '"></td>' +
      '<td><input type="number" class="ing-custo" min="0" step="0.01" placeholder="5.00" value="' + (data.custoEmbalagem || '') + '"></td>' +
      '<td class="cost-display">' + formatCurrency(cost) + '</td>' +
      '<td><button class="btn-remove-ingredient" title="Remover ingrediente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></td>';

    tbody.appendChild(tr);

    // Events
    tr.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => updateFormCalculations());
    });

    tr.querySelector('.btn-remove-ingredient').addEventListener('click', function () {
      showConfirm('Remover Ingrediente', 'Tem certeza que deseja remover este ingrediente?', function () {
        tr.remove();
        if (tbody.children.length === 0) {
          document.getElementById('ingredientsEmpty').style.display = '';
        }
        updateFormCalculations();
      });
    });
  }

  function updateFormCalculations() {
    let totalIngredients = 0;
    document.querySelectorAll('#ingredientsBody tr').forEach(tr => {
      const peso = parseFloat(tr.querySelector('.ing-peso')?.value) || 0;
      const qtd = parseFloat(tr.querySelector('.ing-qtd')?.value) || 0;
      const custo = parseFloat(tr.querySelector('.ing-custo')?.value) || 0;
      const cost = peso > 0 ? (qtd / peso) * custo : 0;
      tr.querySelector('.cost-display').textContent = formatCurrency(cost);
      totalIngredients += cost;
    });

    document.getElementById('ingredientsTotalFoot').textContent = formatCurrency(totalIngredients);

    // Labor
    const salario = parseFloat(document.getElementById('recSalario').value) || 0;
    const dias = parseFloat(document.getElementById('recDias').value) || 1;
    const horas = parseFloat(document.getElementById('recHoras').value) || 1;
    const horasMes = dias * horas;
    const custoHora = horasMes > 0 ? salario / horasMes : 0;
    const prepTime = parseFloat(document.getElementById('recipePrepTime').value) || 0;
    const laborCost = (prepTime / 60) * custoHora;

    document.getElementById('valorHora').textContent = formatCurrency(custoHora);
    document.getElementById('laborCostDisplay').textContent = formatCurrency(laborCost);

    // Expenses
    let totalExpenses = 0;
    document.querySelectorAll('.despesa-input').forEach(input => {
      totalExpenses += parseFloat(input.value) || 0;
    });
    const dailyExpense = totalExpenses / 30;
    document.getElementById('expensesCostDisplay').textContent = formatCurrency(dailyExpense);

    // Summary
    const totalCost = totalIngredients + laborCost + dailyExpense;
    const margin = parseFloat(document.getElementById('recipeMargin').value) || 0;
    const finalPrice = totalCost * (1 + margin / 100);
    const rendimento = parseFloat(document.getElementById('recipeYield').value) || 1;
    const costPerUnit = totalCost / rendimento;
    const pricePerUnit = finalPrice / rendimento;

    document.getElementById('sumIngredients').textContent = formatCurrency(totalIngredients);
    document.getElementById('sumLabor').textContent = formatCurrency(laborCost);
    document.getElementById('sumExpenses').textContent = formatCurrency(dailyExpense);
    document.getElementById('sumTotal').textContent = formatCurrency(totalCost);
    document.getElementById('sumMargin').textContent = margin + '%';
    document.getElementById('sumPrice').textContent = formatCurrency(finalPrice);
    document.getElementById('sumCostUnit').textContent = formatCurrency(costPerUnit);
    document.getElementById('sumPriceUnit').textContent = formatCurrency(pricePerUnit);
  }

  // ========== VIEW RECIPE ==========
  function viewRecipe(id) {
    const recipe = appData.receitas.find(r => r.id === id);
    if (!recipe) return;

    recalculateRecipe(recipe);

    // Navigate
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-view-recipe').classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector('[data-page="recipes"]')?.classList.add('active');
    closeMobileMenu();
    window.scrollTo(0, 0);

    // Photo
    if (recipe.foto) {
      document.getElementById('viewPhoto').src = recipe.foto;
      document.getElementById('viewPhoto').style.display = '';
      document.getElementById('viewPhotoPlaceholder').style.display = 'none';
    } else {
      document.getElementById('viewPhoto').style.display = 'none';
      document.getElementById('viewPhotoPlaceholder').style.display = '';
    }

    document.getElementById('viewCategory').textContent = recipe.categoria || '';
    document.getElementById('viewCategory').style.display = recipe.categoria ? '' : 'none';
    document.getElementById('viewName').textContent = recipe.nome;
    document.getElementById('viewDesc').textContent = recipe.descricao || '';
    document.getElementById('viewYield').textContent = recipe.rendimento ? 'Rendimento: ' + recipe.rendimento + ' unid.' : '';
    document.getElementById('viewPrepTime').textContent = recipe.tempoPreparo ? 'Preparo: ' + recipe.tempoPreparo + ' min' : '';
    document.getElementById('viewUpdated').textContent = 'Atualizado: ' + formatDate(recipe.dataAtualizacao || recipe.dataCriacao);

    // Financial
    document.getElementById('viewCostTotal').textContent = formatCurrency(recipe.custoTotal);
    document.getElementById('viewCostUnit').textContent = formatCurrency(recipe.custoPorUnidade);
    document.getElementById('viewMargin').textContent = (recipe.margemLucro || 0) + '%';
    document.getElementById('viewPrice').textContent = formatCurrency(recipe.precoSugerido);
    document.getElementById('viewPriceUnit').textContent = formatCurrency(recipe.precoPorUnidade);

    // Ingredients table
    const tbody = document.getElementById('viewIngredientsBody');
    tbody.innerHTML = '';
    let totalIng = 0;
    recipe.ingredientes.forEach(ing => {
      const cost = calcIngredientCost(ing);
      totalIng += cost;
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(ing.nome) + '</td>' +
        '<td>' + (ing.pesoEmbalagem || '—') + '</td>' +
        '<td>' + (ing.quantidadeUtilizada || '—') + '</td>' +
        '<td>' + formatCurrency(ing.custoEmbalagem) + '</td>' +
        '<td class="cost-display">' + formatCurrency(cost) + '</td>';
      tbody.appendChild(tr);
    });
    document.getElementById('viewIngredientsTotal').textContent = formatCurrency(totalIng);

    // Labor
    document.getElementById('viewSalary').textContent = formatCurrency(recipe.maoObra?.salario || 0);
    document.getElementById('viewDays').textContent = (recipe.maoObra?.dias || '—') + ' dias';
    document.getElementById('viewHours').textContent = (recipe.maoObra?.horas || '—') + 'h';
    document.getElementById('viewHourRate').textContent = formatCurrency(recipe.valorHora || 0);
    document.getElementById('viewLaborCost').textContent = formatCurrency(recipe.custoMaoObra || 0);

    // Expenses
    const expGrid = document.getElementById('viewExpensesGrid');
    expGrid.innerHTML = '';
    if (recipe.despesas) {
      Object.entries(recipe.despesas).forEach(([nome, valor]) => {
        if (valor) {
          expGrid.innerHTML += '<div class="detail-item"><span>' + escapeHtml(nome) + '</span><strong>' + formatCurrency(valor) + '</strong></div>';
        }
      });
    }
    document.getElementById('viewExpenseTotal').textContent = formatCurrency(recipe.custoDespesas || 0);

    // Price alerts
    const alerts = getRecipePriceAlerts(recipe);
    const alertsContainer = document.getElementById('viewPriceAlerts');
    const alertsList = document.getElementById('viewAlertsList');
    if (alerts.length > 0) {
      alertsContainer.style.display = '';
      alertsList.innerHTML = alerts.map(a => {
        const sign = a.diferenca > 0 ? '+' : '';
        return '<div class="recipe-alert-item">' +
          '<strong>⚠️ ' + escapeHtml(a.nome) + '</strong> ' +
          '<span>Nesta receita: ' + formatCurrency(a.precoReceita) + '</span> ' +
          '<span>Preço mais recente: ' + formatCurrency(a.precoRecente) + '</span> ' +
          '<span class="' + (a.diferenca > 0 ? 'alert-increase' : 'alert-decrease') + '">' + sign + formatCurrency(a.diferenca) + ' (' + sign + a.percentual.toFixed(2) + '%)</span>' +
          '</div>';
      }).join('');
    } else {
      alertsContainer.style.display = 'none';
    }

    // Store current view ID for action buttons
    document.getElementById('page-view-recipe').dataset.recipeId = id;
  }

  // ========== DUPLICATE RECIPE ==========
  function duplicateRecipe(id) {
    const original = appData.receitas.find(r => r.id === id);
    if (!original) return;

    const copy = JSON.parse(JSON.stringify(original));
    copy.id = generateId();
    copy.nome = original.nome + ' (cópia)';
    copy.dataCriacao = new Date().toISOString();
    copy.dataAtualizacao = new Date().toISOString();

    appData.receitas.push(copy);
    saveData();
    showToast('Receita duplicada com sucesso!', 'success');
    renderRecipesList();
    navigateTo('recipes');
  }

  // ========== DELETE RECIPE ==========
  function deleteRecipe(id) {
    const recipe = appData.receitas.find(r => r.id === id);
    if (!recipe) return;

    showConfirm(
      'Excluir Receita',
      'Tem certeza que deseja excluir "' + recipe.nome + '"? Essa ação não poderá ser desfeita.',
      function () {
        appData.receitas = appData.receitas.filter(r => r.id !== id);
        saveData();
        showToast('Receita excluída.', 'warning');
        navigateTo('recipes');
      }
    );
  }

  // ========== RECIPE PRICE ALERTS (form) ==========
  function renderRecipePriceAlerts(alerts) {
    const container = document.getElementById('recipePriceAlerts');
    const list = document.getElementById('recipeAlertsList');
    if (alerts.length > 0) {
      container.style.display = '';
      list.innerHTML = alerts.map(a => {
        const sign = a.diferenca > 0 ? '+' : '';
        return '<div class="recipe-alert-item">' +
          '<strong>⚠️ ' + escapeHtml(a.nome) + '</strong> ' +
          '<span>Nesta receita: ' + formatCurrency(a.precoReceita) + '</span> ' +
          '<span>Preço mais recente: ' + formatCurrency(a.precoRecente) + '</span> ' +
          '<span class="' + (a.diferenca > 0 ? 'alert-increase' : 'alert-decrease') + '">' + sign + formatCurrency(a.diferenca) + ' (' + sign + a.percentual.toFixed(2) + '%)</span>' +
          '</div>';
      }).join('');
    } else {
      container.style.display = 'none';
    }
  }

  // ========== PRICE COMPARE PAGE ==========
  function renderPriceCompare() {
    // Alerts
    const alerts = getPriceAlerts();
    const alertsList = document.getElementById('priceAlertsList');
    if (alerts.length > 0) {
      alertsList.innerHTML = alerts.map(a => renderAlertItem(a)).join('');
    } else {
      alertsList.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">Nenhuma alteração de preço detectada.</p>';
    }

    // History
    renderIngredientHistory();

    // Compare selects
    populateCompareSelects();
  }

  function renderIngredientHistory(filter) {
    const container = document.getElementById('ingredientHistoryList');
    container.innerHTML = '';
    const history = appData.historicoPrecos;
    const keys = Object.keys(history);

    if (keys.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">Nenhum ingrediente registrado ainda.</p>';
      return;
    }

    const searchTerm = (filter || document.getElementById('searchIngredient')?.value || '').trim().toLowerCase();

    let filtered = keys;
    if (searchTerm) {
      filtered = keys.filter(k => k.includes(searchTerm));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 16px;">Nenhum ingrediente encontrado.</p>';
      return;
    }

    filtered.forEach(key => {
      const item = history[key];
      const sorted = [...item.entradas].sort((a, b) => new Date(b.data) - new Date(a.data));

      const card = document.createElement('div');
      card.className = 'ingredient-history-card';

      let entriesHtml = sorted.slice(0, 10).map(e =>
        '<div class="history-entry">' +
          '<span class="history-date">' + formatDate(e.data) + (e.receita ? ' — ' + escapeHtml(e.receita) : '') + '</span>' +
          '<span class="history-price">' + formatCurrency(e.preco) + '</span>' +
        '</div>'
      ).join('');

      // Mini chart
      const chartData = [...sorted].reverse().slice(-8);
      const maxPrice = Math.max(...chartData.map(e => e.preco), 1);
      let chartHtml = '<div class="price-chart">';
      chartData.forEach(e => {
        const height = Math.max(4, (e.preco / maxPrice) * 50);
        const dateLabel = new Date(e.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        chartHtml += '<div class="price-chart-bar" style="height:' + height + 'px" data-label="' + dateLabel + '" title="' + formatCurrency(e.preco) + '"></div>';
      });
      chartHtml += '</div>';

      card.innerHTML =
        '<h3>' + escapeHtml(item.nome) + '</h3>' +
        '<div class="history-entries">' + entriesHtml + '</div>' +
        chartHtml;

      container.appendChild(card);
    });
  }

  // ========== RECIPE COMPARISON ==========
  function populateCompareSelects() {
    const selectA = document.getElementById('compareA');
    const selectB = document.getElementById('compareB');
    const options = appData.receitas.map(r => '<option value="' + r.id + '">' + escapeHtml(r.nome) + '</option>').join('');
    selectA.innerHTML = '<option value="">Selecione...</option>' + options;
    selectB.innerHTML = '<option value="">Selecione...</option>' + options;
  }

  function compareRecipes() {
    const idA = document.getElementById('compareA').value;
    const idB = document.getElementById('compareB').value;
    const container = document.getElementById('compareResult');

    if (!idA || !idB) {
      showToast('Selecione duas receitas para comparar.', 'error');
      return;
    }

    if (idA === idB) {
      showToast('Selecione receitas diferentes.', 'error');
      return;
    }

    const recA = appData.receitas.find(r => r.id === idA);
    const recB = appData.receitas.find(r => r.id === idB);
    if (!recA || !recB) return;

    recalculateRecipe(recA);
    recalculateRecipe(recB);

    // General comparison
    let html = '<table class="compare-table"><thead><tr><th>Item</th><th>' + escapeHtml(recA.nome) + '</th><th>' + escapeHtml(recB.nome) + '</th></tr></thead><tbody>';
    const rows = [
      ['Custo total', formatCurrency(recA.custoTotal), formatCurrency(recB.custoTotal)],
      ['Custo/unidade', formatCurrency(recA.custoPorUnidade), formatCurrency(recB.custoPorUnidade)],
      ['Rendimento', (recA.rendimento || '—') + ' unid.', (recB.rendimento || '—') + ' unid.'],
      ['Margem', (recA.margemLucro || 0) + '%', (recB.margemLucro || 0) + '%'],
      ['Preço sugerido', formatCurrency(recA.precoSugerido), formatCurrency(recB.precoSugerido)],
      ['Preço/unidade', formatCurrency(recA.precoPorUnidade), formatCurrency(recB.precoPorUnidade)],
    ];
    rows.forEach(row => {
      html += '<tr><td><strong>' + row[0] + '</strong></td><td>' + row[1] + '</td><td>' + row[2] + '</td></tr>';
    });
    html += '</tbody></table>';

    // Common ingredients
    const ingsA = {};
    recA.ingredientes.forEach(ing => {
      if (ing.nome) ingsA[normalizeIngredientName(ing.nome)] = ing;
    });

    const common = [];
    recB.ingredientes.forEach(ing => {
      if (ing.nome) {
        const key = normalizeIngredientName(ing.nome);
        if (ingsA[key]) {
          common.push({ nome: ing.nome, a: ingsA[key], b: ing });
        }
      }
    });

    if (common.length > 0) {
      html += '<h3 class="compare-common-title section-title">Ingredientes em Comum</h3>';
      html += '<table class="compare-table"><thead><tr><th>Ingrediente</th><th>' + escapeHtml(recA.nome) + ' (custo emb.)</th><th>' + escapeHtml(recB.nome) + ' (custo emb.)</th><th>Diferença</th></tr></thead><tbody>';
      common.forEach(c => {
        const diff = (parseFloat(c.b.custoEmbalagem) || 0) - (parseFloat(c.a.custoEmbalagem) || 0);
        const cls = diff > 0 ? 'alert-increase' : diff < 0 ? 'alert-decrease' : '';
        const sign = diff > 0 ? '+' : '';
        html += '<tr><td>' + escapeHtml(c.nome) + '</td><td>' + formatCurrency(c.a.custoEmbalagem) + '</td><td>' + formatCurrency(c.b.custoEmbalagem) + '</td><td class="' + cls + '">' + sign + formatCurrency(diff) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    container.innerHTML = html;
    container.style.display = '';
  }

  // ========== SETTINGS ==========
  function renderSettings() {
    const cfg = appData.configuracoes;

    // Default expenses
    if (cfg.despesasPadrao) {
      Object.entries(cfg.despesasPadrao).forEach(([key, val]) => {
        const nameMap = { Aluguel: 'defaultAluguel', Energia: 'defaultEnergia', 'Água': 'defaultAgua', Internet: 'defaultInternet', 'Escritório': 'defaultEscritorio', Mei: 'defaultMei' };
        const el = document.getElementById(nameMap[key]);
        if (el) el.value = val || '';
      });
    }

    // Default labor
    if (cfg.maoObraPadrao) {
      document.getElementById('defaultSalario').value = cfg.maoObraPadrao.salario || '';
      document.getElementById('defaultDias').value = cfg.maoObraPadrao.dias || '';
      document.getElementById('defaultHoras').value = cfg.maoObraPadrao.horas || '';
    }
  }

  function saveDefaultExpenses() {
    appData.configuracoes.despesasPadrao = {
      Aluguel: document.getElementById('defaultAluguel').value,
      Energia: document.getElementById('defaultEnergia').value,
      'Água': document.getElementById('defaultAgua').value,
      Internet: document.getElementById('defaultInternet').value,
      'Escritório': document.getElementById('defaultEscritorio').value,
      Mei: document.getElementById('defaultMei').value
    };
    saveData();
    showToast('Despesas padrão salvas!', 'success');
  }

  function saveLaborDefaults() {
    appData.configuracoes.maoObraPadrao = {
      salario: document.getElementById('defaultSalario').value,
      dias: document.getElementById('defaultDias').value,
      horas: document.getElementById('defaultHoras').value
    };
    saveData();
    showToast('Mão de obra padrão salva!', 'success');
  }

  // ========== EXPORT / IMPORT ==========
  function exportData() {
    const json = JSON.stringify(appData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = 'jl-delicias-backup-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso!', 'success');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.receitas && Array.isArray(imported.receitas)) {
          appData = Object.assign(getDefaultData(), imported);
          saveData();
          showToast('Dados importados com sucesso!', 'success');
          navigateTo('dashboard');
        } else {
          showToast('Arquivo inválido. Verifique o formato.', 'error');
        }
      } catch (err) {
        showToast('Erro ao ler o arquivo.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ========== PHOTO HANDLING ==========
  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check size (max 2MB to avoid localStorage issues)
    if (file.size > 2 * 1024 * 1024) {
      showToast('A imagem é muito grande. Use uma imagem de até 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (ev) {
      // Resize to save storage space
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = (h / w) * maxDim; w = maxDim; }
          else { w = (w / h) * maxDim; h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoPreview(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ========== INIT ==========
  function init() {
    loadData();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        const page = this.dataset.page;
        if (page === 'new-recipe') {
          currentEditId = null;
          clearRecipeForm();
        }
        navigateTo(page);
      });
    });

    // Mobile menu
    document.getElementById('hamburger').addEventListener('click', openMobileMenu);
    document.getElementById('sidebarOverlay').addEventListener('click', closeMobileMenu);

    // New recipe buttons
    document.getElementById('btnNewFromDash').addEventListener('click', () => { currentEditId = null; clearRecipeForm(); navigateTo('new-recipe'); });
    document.getElementById('btnNewFromList').addEventListener('click', () => { currentEditId = null; clearRecipeForm(); navigateTo('new-recipe'); });
    document.getElementById('btnFirstRecipe')?.addEventListener('click', () => { currentEditId = null; clearRecipeForm(); navigateTo('new-recipe'); });

    // Recipe form
    document.getElementById('btnAddIngredient').addEventListener('click', () => addIngredientRow());
    document.getElementById('btnSaveRecipe').addEventListener('click', saveRecipe);
    document.getElementById('btnCancelRecipe').addEventListener('click', () => {
      currentEditId = null;
      navigateTo('recipes');
    });

    // Photo
    document.getElementById('photoUpload').addEventListener('click', () => document.getElementById('photoInput').click());
    document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);

    // Form auto-calculate
    ['recSalario', 'recDias', 'recHoras', 'recipePrepTime', 'recipeYield', 'recipeMargin'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateFormCalculations);
    });
    document.querySelectorAll('.despesa-input').forEach(input => {
      input.addEventListener('input', updateFormCalculations);
    });

    // View recipe actions
    document.getElementById('btnBackFromView').addEventListener('click', () => navigateTo('recipes'));
    document.getElementById('btnEditRecipe').addEventListener('click', () => {
      const id = document.getElementById('page-view-recipe').dataset.recipeId;
      editRecipe(id);
    });
    document.getElementById('btnDuplicateRecipe').addEventListener('click', () => {
      const id = document.getElementById('page-view-recipe').dataset.recipeId;
      duplicateRecipe(id);
    });
    document.getElementById('btnDeleteRecipe').addEventListener('click', () => {
      const id = document.getElementById('page-view-recipe').dataset.recipeId;
      deleteRecipe(id);
    });

    // Search & filters
    document.getElementById('searchRecipes').addEventListener('input', renderRecipesList);
    document.querySelectorAll('.filter-tag').forEach(tag => {
      tag.addEventListener('click', function () {
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        renderRecipesList();
      });
    });

    // Price compare
    document.getElementById('btnCompare').addEventListener('click', compareRecipes);
    document.getElementById('searchIngredient')?.addEventListener('input', function () {
      renderIngredientHistory(this.value);
    });

    // Settings
    document.getElementById('btnSaveDefaults').addEventListener('click', saveDefaultExpenses);
    document.getElementById('btnSaveLaborDefaults').addEventListener('click', saveLaborDefaults);

    // Export / Import (sidebar)
    document.getElementById('btnExport').addEventListener('click', exportData);
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', function () {
      if (this.files[0]) importData(this.files[0]);
      this.value = '';
    });

    // Export / Import (settings)
    document.getElementById('btnExportSettings').addEventListener('click', exportData);
    document.getElementById('btnImportSettings').addEventListener('click', () => document.getElementById('importFileSettings').click());
    document.getElementById('importFileSettings').addEventListener('change', function () {
      if (this.files[0]) importData(this.files[0]);
      this.value = '';
    });

    // Clear all
    document.getElementById('btnClearAll').addEventListener('click', () => {
      showConfirm('Apagar Todos os Dados', 'Tem certeza? Todas as receitas, histórico e configurações serão removidos permanentemente.', function () {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(OLD_STORAGE_KEY);
        appData = getDefaultData();
        showToast('Todos os dados foram apagados.', 'warning');
        navigateTo('dashboard');
      });
    });

    // Confirm modal
    document.getElementById('confirmOk').addEventListener('click', () => {
      hideConfirm();
      if (confirmCallback) confirmCallback();
    });
    document.getElementById('confirmCancel').addEventListener('click', hideConfirm);
    document.getElementById('confirmModal').addEventListener('click', function (e) {
      if (e.target === this) hideConfirm();
    });

    // Close dropdowns on click outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.recipe-card-menu')) {
        closeAllDropdowns();
      }
    });

    // Render dashboard
    navigateTo('dashboard');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

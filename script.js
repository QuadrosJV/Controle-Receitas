function adicionarIngrediente(dados = {}) {
  const tbody = document.getElementById('ingredientesBody');
  const tr = document.createElement('tr');

  const tdNome = document.createElement('td');
  const inputNome = document.createElement('input');
  inputNome.type = 'text';
  inputNome.className = 'nome';
  inputNome.value = dados.nome || '';
  tdNome.appendChild(inputNome);

  const tdPeso = document.createElement('td');
  const inputPeso = document.createElement('input');
  inputPeso.type = 'number';
  inputPeso.className = 'peso';
  inputPeso.value = dados.peso || '';
  tdPeso.appendChild(inputPeso);

  const tdQtd = document.createElement('td');
  const inputQtd = document.createElement('input');
  inputQtd.type = 'number';
  inputQtd.className = 'quantidade';
  inputQtd.value = dados.quantidade || '';
  tdQtd.appendChild(inputQtd);

  const tdCusto = document.createElement('td');
  const inputCusto = document.createElement('input');
  inputCusto.type = 'number';
  inputCusto.className = 'custo';
  inputCusto.value = dados.custo || '';
  tdCusto.appendChild(inputCusto);

  const tdPreco = document.createElement('td');
  tdPreco.className = 'preco';
  tdPreco.textContent = dados.preco || '0.00';

  const tdRemover = document.createElement('td');
  const btnRemover = document.createElement('button');
  btnRemover.textContent = 'Remover';
  btnRemover.onclick = function () {
    tr.remove();
    salvarDados();
  };
  tdRemover.appendChild(btnRemover);

  tr.appendChild(tdNome);
  tr.appendChild(tdPeso);
  tr.appendChild(tdQtd);
  tr.appendChild(tdCusto);
  tr.appendChild(tdPreco);
  tr.appendChild(tdRemover);

  tbody.appendChild(tr);

  [inputNome, inputPeso, inputQtd, inputCusto].forEach(input => {
    input.addEventListener('input', () => {
      calcularTudo();
      salvarDados();
    });
  });
}

function calcularTudo() {
  let totalIngredientes = 0;
  const ingredientes = [];

  document.querySelectorAll('#ingredientesBody tr').forEach(tr => {
    const nome = tr.querySelector('.nome')?.value || '';
    const peso = parseFloat(tr.querySelector('.peso')?.value) || 0;
    const qtd = parseFloat(tr.querySelector('.quantidade')?.value) || 0;
    const custo = parseFloat(tr.querySelector('.custo')?.value) || 0;

    const preco = (peso > 0) ? (qtd / peso) * custo : 0;
    totalIngredientes += preco;
    tr.querySelector('.preco').textContent = preco.toFixed(2);

    ingredientes.push({ nome, peso, quantidade: qtd, custo, preco: preco.toFixed(2) });
  });

  const salario = parseFloat(document.getElementById('salario').value) || 0;
  const dias = parseFloat(document.getElementById('diasTrabalho').value) || 1;
  const horasDia = parseFloat(document.getElementById('horasDia').value) || 1;
  const horasMes = dias * horasDia;
  const custoHora = salario / horasMes;
  const tempoPreparo = parseFloat(document.getElementById('tempoPreparo').value) || 0;
  const custoMaoObra = (tempoPreparo / 60) * custoHora;

  let totalDespesas = 0;
  document.querySelectorAll('.despesa').forEach(input => {
    totalDespesas += parseFloat(input.value) || 0;
  });
  const despesaPorReceita = totalDespesas / 30;

  const valorTotal = totalIngredientes + custoMaoObra + despesaPorReceita;
  const lucroPercentual = parseFloat(document.getElementById('lucro').value) || 0;
  const valorComLucro = valorTotal * (1 + lucroPercentual / 100);

  document.getElementById('custoIngredientes').textContent = totalIngredientes.toFixed(2);
  document.getElementById('custoMaoObra').textContent = custoMaoObra.toFixed(2);
  document.getElementById('custoDespesas').textContent = despesaPorReceita.toFixed(2);
  document.getElementById('valorTotal').textContent = valorTotal.toFixed(2);
  document.getElementById('valorComLucro').textContent = valorComLucro.toFixed(2);

  salvarDados();
}

function salvarDados() {
  const ingredientes = [];
  document.querySelectorAll('#ingredientesBody tr').forEach(tr => {
    ingredientes.push({
      nome: tr.querySelector('.nome')?.value || '',
      peso: tr.querySelector('.peso')?.value || '',
      quantidade: tr.querySelector('.quantidade')?.value || '',
      custo: tr.querySelector('.custo')?.value || '',
      preco: tr.querySelector('.preco')?.textContent || '0.00'
    });
  });

  const maoObra = {
    salario: document.getElementById('salario').value || '',
    dias: document.getElementById('diasTrabalho').value || '',
    horas: document.getElementById('horasDia').value || ''
  };

  const despesas = {};
  document.querySelectorAll('.despesa').forEach(input => {
    despesas[input.dataset.nome] = input.value || '';
  });

  const outros = {
    rendimento: document.getElementById('rendimento').value || '',
    tempoPreparo: document.getElementById('tempoPreparo').value || '',
    lucro: document.getElementById('lucro').value || ''
  };

  const dados = { ingredientes, maoObra, despesas, outros };
  localStorage.setItem('fichaTecnicaJL', JSON.stringify(dados));
}

function carregarDados() {
  const dadosSalvos = localStorage.getItem('fichaTecnicaJL');
  if (!dadosSalvos) return;

  const dados = JSON.parse(dadosSalvos);

  if (dados.ingredientes) {
    dados.ingredientes.forEach(ing => adicionarIngrediente(ing));
  }

  if (dados.maoObra) {
    document.getElementById('salario').value = dados.maoObra.salario || '';
    document.getElementById('diasTrabalho').value = dados.maoObra.dias || '';
    document.getElementById('horasDia').value = dados.maoObra.horas || '';
  }

  if (dados.despesas) {
    document.querySelectorAll('.despesa').forEach(input => {
      const nome = input.dataset.nome;
      input.value = dados.despesas[nome] || '';
    });
  }

  if (dados.outros) {
    document.getElementById('rendimento').value = dados.outros.rendimento || '';
    document.getElementById('tempoPreparo').value = dados.outros.tempoPreparo || '';
    document.getElementById('lucro').value = dados.outros.lucro || '';
  }

  calcularTudo();
}

window.onload = carregarDados;

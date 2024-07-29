document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('nav a');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(tab.getAttribute('href'));

            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Inicializa a primeira aba
    tabs[0].click();

    let db;
    const request = indexedDB.open('PDVDatabase', 1);

    request.onupgradeneeded = function(event) {
        db = event.target.result;

        const caixaStore = db.createObjectStore('caixa', { keyPath: 'id', autoIncrement: true });
        caixaStore.createIndex('saldoInicial', 'saldoInicial', { unique: false });
        caixaStore.createIndex('saldoFinal', 'saldoFinal', { unique: false });
        caixaStore.createIndex('transacoes', 'transacoes', { unique: false });

        const vendasStore = db.createObjectStore('vendas', { keyPath: 'id', autoIncrement: true });
        vendasStore.createIndex('produto', 'produto', { unique: false });
        vendasStore.createIndex('quantidade', 'quantidade', { unique: false });
        vendasStore.createIndex('preco', 'preco', { unique: false });
        vendasStore.createIndex('hora', 'hora', { unique: false });

        const estoqueStore = db.createObjectStore('estoque', { keyPath: 'id', autoIncrement: true });
        estoqueStore.createIndex('produto', 'produto', { unique: false });
        estoqueStore.createIndex('quantidade', 'quantidade', { unique: false });
        estoqueStore.createIndex('valor', 'valor', { unique: false });
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        carregarProdutos();
        carregarHistoricoVendas();
        carregarEstoque();
    };

    request.onerror = function(event) {
        console.error('Database error:', event.target.errorCode);
    };

    let caixa = null;

    const abrirCaixaBtn = document.getElementById('abrirCaixaBtn');
    const fecharCaixaBtn = document.getElementById('fecharCaixa');
    const saldoInicialDiv = document.getElementById('saldoInicialDiv');
    const saldoCaixaDiv = document.getElementById('saldoCaixa');
    const vendaForm = document.getElementById('vendaForm');
    const listaVendasDiv = document.getElementById('listaVendas');
    const estoqueForm = document.getElementById('estoqueForm');
    const listaEstoqueDiv = document.getElementById('listaEstoque');
    const calcularFaturamentoBtn = document.getElementById('calcularFaturamento');
    const totalFaturamentoDiv = document.getElementById('totalFaturamento');
    const historicoVendasDiv = document.getElementById('historicoVendas');

    abrirCaixaBtn.addEventListener('click', () => {
        const saldoInicial = parseFloat(prompt('Digite o saldo inicial do caixa:'));
        if (isNaN(saldoInicial) || saldoInicial < 0) {
            alert('Por favor, insira um valor válido para o saldo inicial.');
            return;
        }

        caixa = {
            saldoInicial,
            saldoFinal: 0,
            transacoes: []
        };

        saldoInicialDiv.textContent = `Saldo Inicial: R$${saldoInicial.toFixed(2)}`;
        saveCaixa(caixa);
    });

    fecharCaixaBtn.addEventListener('click', () => {
        if (!caixa) {
            alert('O caixa ainda não foi aberto.');
            return;
        }

        caixa.saldoFinal = caixa.saldoInicial + caixa.transacoes.reduce((total, transacao) => total + transacao.preco * transacao.quantidade, 0);
        saldoCaixaDiv.textContent = `Saldo Final: R$${caixa.saldoFinal.toFixed(2)}`;
        saveCaixa(caixa);

        caixa = null;
    });

    vendaForm.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!caixa) {
            alert('O caixa ainda não foi aberto.');
            return;
        }

        const produto = e.target.produto.value;
        const quantidade = parseInt(e.target.quantidade.value);
        const preco = parseFloat(e.target.preco.value);

        if (!produto || isNaN(quantidade) || isNaN(preco)) {
            alert('Por favor, preencha todos os campos da venda corretamente.');
            return;
        }

        const venda = { produto, quantidade, preco, hora: new Date().toLocaleTimeString() };
        caixa.transacoes.push(venda);

        const vendaItem = document.createElement('div');
        vendaItem.textContent = `Produto: ${produto}, Quantidade: ${quantidade}, Preço: R$${preco.toFixed(2)}, Hora: ${venda.hora}`;
        listaVendasDiv.appendChild(vendaItem);

        atualizarEstoque(produto, -quantidade);

        saveVenda(venda);

        e.target.reset();
    });

    estoqueForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const produto = e.target.produtoEstoque.value;
        const quantidade = parseInt(e.target.quantidadeEstoque.value);
        const valor = parseFloat(e.target.valorEstoque.value);

        if (!produto || isNaN(quantidade) || isNaN(valor)) {
            alert('Por favor, preencha todos os campos do estoque corretamente.');
            return;
        }

        const itemEstoque = { produto, quantidade, valor };
        saveEstoque(itemEstoque);

        carregarEstoque();

        e.target.reset();
    });

    calcularFaturamentoBtn.addEventListener('click', () => {
        if (!caixa) {
            alert('O caixa ainda não foi aberto.');
            return;
        }

        const total = caixa.transacoes.reduce((total, transacao) => total + transacao.preco * transacao.quantidade, 0);
        totalFaturamentoDiv.textContent = `Total Faturado: R$${total.toFixed(2)}`;
    });

    function carregarProdutos() {
        const transaction = db.transaction(['estoque'], 'readonly');
        const store = transaction.objectStore('estoque');

        const produtoLista = document.getElementById('produtoLista');
        produtoLista.innerHTML = '';

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const option = document.createElement('option');
                option.value = cursor.value.produto;
                produtoLista.appendChild(option);
                cursor.continue();
            }
        };
    }

    document.getElementById('produto').addEventListener('input', function() {
        const produto = this.value;
        const transaction = db.transaction(['estoque'], 'readonly');
        const store = transaction.objectStore('estoque');

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.produto === produto) {
                    document.getElementById('estoqueDisponivel').textContent = `Quantidade Disponível: ${cursor.value.quantidade}`;
                    document.getElementById('preco').value = cursor.value.valor.toFixed(2);
                    return;
                }
                cursor.continue();
            } else {
                document.getElementById('estoqueDisponivel').textContent = '';
                document.getElementById('preco').value = '';
            }
        };
    });

    function atualizarEstoque(produto, quantidade) {
        const transaction = db.transaction(['estoque'], 'readwrite');
        const store = transaction.objectStore('estoque');

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                if (cursor.value.produto === produto) {
                    const updatedItem = cursor.value;
                    updatedItem.quantidade += quantidade;
                    cursor.update(updatedItem);
                    carregarEstoque();
                    return;
                }
                cursor.continue();
            }
        };
    }

    function saveCaixa(caixa) {
        const transaction = db.transaction(['caixa'], 'readwrite');
        const store = transaction.objectStore('caixa');
        store.add(caixa);
    }

    function saveVenda(venda) {
        const transaction = db.transaction(['vendas'], 'readwrite');
        const store = transaction.objectStore('vendas');
        store.add(venda);
    }

    function saveEstoque(itemEstoque) {
        const transaction = db.transaction(['estoque'], 'readwrite');
        const store = transaction.objectStore('estoque');
        store.add(itemEstoque);
    }

    function carregarHistoricoVendas() {
        const transaction = db.transaction(['vendas'], 'readonly');
        const store = transaction.objectStore('vendas');

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const venda = cursor.value;
                const vendaItem = document.createElement('div');
                vendaItem.textContent = `Produto: ${venda.produto}, Quantidade: ${venda.quantidade}, Preço: R$${venda.preco.toFixed(2)}, Hora: ${venda.hora}`;
                historicoVendasDiv.appendChild(vendaItem);
                cursor.continue();
            }
        };
    }

    function carregarEstoque() {
        const transaction = db.transaction(['estoque'], 'readonly');
        const store = transaction.objectStore('estoque');

        listaEstoqueDiv.innerHTML = '';

        store.openCursor().onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const item = cursor.value;
                const itemDiv = document.createElement('div');
                itemDiv.textContent = `Produto: ${item.produto}, Quantidade: ${item.quantidade}, Valor: R$${item.valor.toFixed(2)}`;
                listaEstoqueDiv.appendChild(itemDiv);

                const editarBtn = document.createElement('button');
                editarBtn.textContent = 'Editar';
                editarBtn.addEventListener('click', () => editarProduto(item));
                itemDiv.appendChild(editarBtn);

                const excluirBtn = document.createElement('button');
                excluirBtn.textContent = 'Excluir';
                excluirBtn.addEventListener('click', () => excluirProduto(item.id));
                itemDiv.appendChild(excluirBtn);

                cursor.continue();
            }
        };
    }

    function editarProduto(item) {
        const novoProduto = prompt('Novo nome do produto:', item.produto);
        const novaQuantidade = parseInt(prompt('Nova quantidade:', item.quantidade));
        const novoValor = parseFloat(prompt('Novo valor:', item.valor));

        if (!novoProduto || isNaN(novaQuantidade) || isNaN(novoValor)) {
            alert('Por favor, preencha todos os campos corretamente.');
            return;
        }

        const transaction = db.transaction(['estoque'], 'readwrite');
        const store = transaction.objectStore('estoque');

        store.get(item.id).onsuccess = function(event) {
            const data = event.target.result;
            data.produto = novoProduto;
            data.quantidade = novaQuantidade;
            data.valor = novoValor;
            store.put(data);
            carregarEstoque();
        };
    }

    function excluirProduto(id) {
        const transaction = db.transaction(['estoque'], 'readwrite');
        const store = transaction.objectStore('estoque');
        store.delete(id).onsuccess = function() {
            carregarEstoque();
        };
    }
});

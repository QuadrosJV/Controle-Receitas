# 🍰 JL Delícias em Camadas — Sistema de Gestão de Receitas e Ficha Técnica

Sistema moderno, elegante e profissional para gestão de custos, cálculo de preço de venda e ficha técnica de confeitaria da **JL Delícias em Camadas**.

🔗 **Acesse online:** [https://quadrosjv.github.io/Controle-Receitas/](https://quadrosjv.github.io/Controle-Receitas/)

---

## ✨ Funcionalidades

- 🏠 **Dashboard Inteligente:** Métricas de receitas cadastradas, custo médio, última receita e alertas de variação de preço.
- 🍰 **Minhas Receitas:** Catálogo visual com fotos, categorias (Bolos, Tortas, Doces, Salgados, Sobremesas, etc.), rendimento, custo total e preço sugerido.
- ➕ **Nova Receita & Ficha Técnica:**
  - Cálculo proporcional de ingredientes: `(quantidade ÷ peso da embalagem) × custo da embalagem`
  - Cálculo automático de mão de obra (salário, dias, horas/dia, valor da hora e tempo de preparo)
  - Rateio de despesas fixas mensais (aluguel, energia, água, internet, escritório, MEI)
  - Margem de lucro personalizada com cálculo de custo e preço por unidade
  - Upload e pré-visualização de fotos da receita (armazenadas em Base64 no navegador)
- 📊 **Comparação & Histórico de Preços:**
  - Histórico por ingrediente com detecção inteligente de variações
  - Alertas automáticos de aumento ou redução de preço
  - Comparador direto lado a lado entre duas receitas
- ⚙️ **Configurações & Backup:**
  - Definição de despesas fixas e mão de obra padrão
  - Exportação e importação de backup em arquivo JSON
  - Migração automática de dados salvos de versões anteriores (`fichaTecnicaJL`)
- 📱 **100% Responsivo:** Otimizado para celular, tablet, notebook e desktop.

---

## 🚀 Como Executar Localmente

Não requer instalação ou servidor backend:

1. Clone o repositório:
   ```bash
   git clone https://github.com/QuadrosJV/Controle-Receitas.git
   ```
2. Abra o arquivo `index.html` em qualquer navegador moderno.

---

## 🛠️ Tecnologias

- **HTML5** semântico
- **CSS3** moderno com Design System customizado (cores da marca, responsivo e animações suaves)
- **JavaScript Vanilla** (ES6+) modularizado
- **LocalStorage** estruturado para persistência de dados local

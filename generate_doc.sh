#!/bin/bash

# Adiciona o cabeçalho
cat << 'INNER_EOF' >> Documento.md

---

## 5. Arquivos de Código-Fonte (Repositório)

Abaixo estão os códigos-fonte completos de todos os arquivos de texto do projeto, ordenados seguindo a estrutura da árvore de diretórios.
*(Nota: Arquivos binários como imagens `.png`, banco local `.db`, pasta `node_modules`, `package-lock.json` e a pasta `dist` de build foram omitidos desta lista).*

INNER_EOF

# Função para adicionar um arquivo
add_file() {
    local file_path=$1
    local lang=$2
    if [ -f "$file_path" ]; then
        echo "### \`$file_path\`" >> Documento.md
        echo "\`\`\`$lang" >> Documento.md
        cat "$file_path" >> Documento.md

        # Adiciona nova linha caso o arquivo não termine com uma
        # e fecha o bloco de código
        echo "" >> Documento.md
        echo "\`\`\`" >> Documento.md
        echo "" >> Documento.md
    fi
}

add_file ".gitignore" "text"
add_file "LICENSE" "text"
add_file "README.md" "markdown"
add_file "backend/package.json" "json"
add_file "backend/src/index.js" "javascript"
add_file "backend/wrangler.toml" "toml"
add_file "database/schema.sql" "sql"
add_file "database/seed.sql" "sql"
add_file "frontend/admin.html" "html"
add_file "frontend/index.html" "html"
add_file "frontend/manifest.json" "json"
add_file "frontend/sw.js" "javascript"
add_file "frontend/css/style.css" "css"
add_file "frontend/js/admin.js" "javascript"
add_file "frontend/js/app.js" "javascript"
add_file "guia.md" "markdown"
add_file "test-cors2.js" "javascript"
add_file "wrangler.jsonc" "jsonc"

# Implantação — ProducaoScan

Pacote para instalar o sistema em um computador Windows da produção.

## Conteúdo

| Arquivo | Função |
| --- | --- |
| `docker-compose.yml` + `sql/init.sql` | Banco PostgreSQL |
| `.env` / `env.example` | Conexão do backend com o banco |
| `producaoscan-api.exe` | API Python (executável) |
| `iniciar-banco.bat` | Sobe só o PostgreSQL |
| `iniciar-backend.bat` | Sobe só a API |
| `iniciar-tudo.bat` | Sobe banco e API |
| `producao_scan.apk` | Aplicativo Android |

## Requisitos no servidor

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Porta **5434** livre (PostgreSQL) e porta **8000** livre (API)

## Instalação

1. Copie esta pasta `deploy` para o computador (ex.: `C:\ProducaoScan`).
2. Se ainda não existir, copie `env.example` para `.env` e ajuste usuário/senha se necessário.
3. Execute `iniciar-tudo.bat`.
4. Confirme no navegador: [http://localhost:8000/api/health](http://localhost:8000/api/health)

## Aplicativo Android

1. Instale `producao_scan.apk` no aparelho (permitir origens desconhecidas).
2. No app, abra **Configurações**.
3. Este APK já aponta para `http://192.168.0.13:8000` (IP deste computador na hora do build).  
   Se o servidor tiver outro IP, altere em **Configurações**.
4. Salve, teste a conexão PostgreSQL e use **Importar do PostgreSQL** para carregar o catálogo.

Celular e servidor precisam estar na mesma rede. O backend escuta em `0.0.0.0:8000`.

## Importação do catálogo

A tabela de origem padrão é `catalogo_origem` (criada pelo `sql/init.sql`).  
Na tela de Configurações do app é possível apontar para outro host/tabela e importar CSV/JSON.

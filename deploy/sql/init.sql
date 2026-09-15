-- Catálogo de origem (base externa / legado) usado na importação.
CREATE TABLE IF NOT EXISTS catalogo_origem (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    preco_kg NUMERIC(12, 2) NOT NULL,
    ippt VARCHAR(1) NOT NULL DEFAULT 'P',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalogo_origem (codigo, nome, categoria, preco_kg) VALUES
    ('00001', 'Picanha', 'Bovinos', 89.90),
    ('00002', 'Alcatra', 'Bovinos', 54.90),
    ('00003', 'Contrafilé', 'Bovinos', 62.50),
    ('00004', 'Fraldinha', 'Bovinos', 49.90),
    ('00005', 'Maminha', 'Bovinos', 52.00),
    ('00006', 'Costela Bovina', 'Bovinos', 38.90),
    ('00011', 'Filé de Frango', 'Aves', 22.90),
    ('00012', 'Coxa e Sobrecoxa', 'Aves', 16.50),
    ('00021', 'Lombo Suíno', 'Suínos', 28.90),
    ('00022', 'Pernil', 'Suínos', 24.90);

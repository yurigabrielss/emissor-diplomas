CREATE TABLE certificados (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nacionalidade VARCHAR(50) NOT NULL,
    estado VARCHAR(50) NOT NULL,
    data_nascimento DATE NOT NULL,
    documento VARCHAR(20) NOT NULL,
    data_conclusao DATE NOT NULL,
    curso VARCHAR(100) NOT NULL,
    carga_horaria INT NOT NULL,
    nome_assinatura VARCHAR(100) NOT NULL,
    cargo VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    pdf_url VARCHAR(255)
);

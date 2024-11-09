# emissor-diplomas

Teste de endpoint com postman

Incluir nos headers:
Content-Type: application/json

POST
http://localhost:3000/certificados
Exemplo de requisição:
{
  "nome": "João da Silva",
  "nacionalidade": "Brasileiro",
  "estado": "SP",
  "data_nascimento": "2000-01-01",
  "documento": "12345678900",
  "data_conclusao": "2024-10-31",
  "curso": "Engenharia de Software",
  "carga_horaria": 360,
  "nome_assinatura": "Dr. Carlos Almeida",
  "cargo": "Diretor Acadêmico"
}

GET
http://localhost:3000/certificados

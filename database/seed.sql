-- Inserção de dados iniciais (Seed)
-- Os preços estão baseados na promoção (1 por 4,00 | 2 por 7,00 | 3 por 10,00)
-- Mas no banco salvaremos o preço unitário base (R$ 4,00).
-- A lógica de desconto (combo) será aplicada no backend/frontend na hora do checkout.

INSERT INTO products (name, description, price, stock, image_url, is_gourmet) VALUES
('Nutella', 'Trufa de chocolate recheada com Nutella', 4.00, 50, '/assets/trufa-nutella.png', 0),
('70% Cacau', 'Trufa de chocolate intenso 70% cacau', 4.00, 50, '/assets/trufa-cacau.png', 0),
('Ferrero', 'Trufa com avelãs inspirada no Ferrero Rocher', 4.00, 50, '/assets/trufa-ferrero.png', 0),
('Tradicional', 'A clássica trufa de chocolate ao leite', 4.00, 50, '/assets/trufa-tradicional.png', 0),
('Morango', 'Trufa recheada com creme de morango', 4.00, 50, '/assets/trufa-morango.png', 0),
('Galak', 'Trufa de chocolate branco Galak', 4.00, 50, '/assets/trufa-galak.png', 0),
('Prestígio', 'Trufa recheada com muito coco', 4.00, 50, '/assets/trufa-prestigio.png', 0),
('Brigadeiro', 'A queridinha trufa de brigadeiro', 4.00, 50, '/assets/trufa-brigadeiro.png', 0),
('Kit Kat', 'Trufa com pedaços crocantes de Kit Kat', 4.00, 50, '/assets/trufa-kitkat.png', 0),
('Banoffee', 'Trufa sabor doce de leite com banana', 4.00, 50, '/assets/trufa-banoffee.png', 0),
('Cereja', 'Trufa recheada com cereja e licor', 4.00, 50, '/assets/trufa-cereja.png', 0),
('Beijinho', 'Trufa de beijinho cremoso', 4.00, 50, '/assets/trufa-beijinho.png', 0),
('Chokito', 'Trufa com flocos crocantes e caramelo', 4.00, 50, '/assets/trufa-chokito.png', 0),
('Sulflair', 'Trufa com textura aerada Suflair', 4.00, 50, '/assets/trufa-suflair.png', 0),
('Ninho', 'Trufa deliciosa de leite Ninho', 4.00, 50, '/assets/trufa-ninho.png', 0),
('Maracujá', 'Trufa recheada com mousse de maracujá', 4.00, 50, '/assets/trufa-maracuja.png', 0),
('Pistache', 'A sofisticada trufa de pistache', 4.00, 50, '/assets/trufa-pistache.png', 0),
('Limão', 'Trufa cítrica e refrescante de limão', 4.00, 50, '/assets/trufa-limao.png', 0);

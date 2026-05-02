-- Inserção de dados iniciais (Seed)
-- Os preços estão baseados na promoção (1 por 4,00 | 2 por 7,00 | 3 por 10,00)
-- Mas no banco salvaremos o preço unitário base (R$ 4,00).
-- A lógica de desconto (combo) será aplicada no backend/frontend na hora do checkout.

INSERT INTO products (name, description, price, stock, image_url) VALUES
('Nutella', 'Trufa de chocolate recheada com Nutella', 4.00, 50, '/assets/trufa-nutella.png'),
('70% Cacau', 'Trufa de chocolate intenso 70% cacau', 4.00, 50, '/assets/trufa-cacau.png'),
('Ferrero', 'Trufa com avelãs inspirada no Ferrero Rocher', 4.00, 50, '/assets/trufa-ferrero.png'),
('Tradicional', 'A clássica trufa de chocolate ao leite', 4.00, 50, '/assets/trufa-tradicional.png'),
('Morango', 'Trufa recheada com creme de morango', 4.00, 50, '/assets/trufa-morango.png'),
('Galak', 'Trufa de chocolate branco Galak', 4.00, 50, '/assets/trufa-galak.png'),
('Prestígio', 'Trufa recheada com muito coco', 4.00, 50, '/assets/trufa-prestigio.png'),
('Brigadeiro', 'A queridinha trufa de brigadeiro', 4.00, 50, '/assets/trufa-brigadeiro.png'),
('Kit Kat', 'Trufa com pedaços crocantes de Kit Kat', 4.00, 50, '/assets/trufa-kitkat.png'),
('Banoffee', 'Trufa sabor doce de leite com banana', 4.00, 50, '/assets/trufa-banoffee.png'),
('Cereja', 'Trufa recheada com cereja e licor', 4.00, 50, '/assets/trufa-cereja.png'),
('Beijinho', 'Trufa de beijinho cremoso', 4.00, 50, '/assets/trufa-beijinho.png'),
('Chokito', 'Trufa com flocos crocantes e caramelo', 4.00, 50, '/assets/trufa-chokito.png'),
('Sulflair', 'Trufa com textura aerada Suflair', 4.00, 50, '/assets/trufa-suflair.png'),
('Ninho', 'Trufa deliciosa de leite Ninho', 4.00, 50, '/assets/trufa-ninho.png'),
('Maracujá', 'Trufa recheada com mousse de maracujá', 4.00, 50, '/assets/trufa-maracuja.png'),
('Pistache', 'A sofisticada trufa de pistache', 4.00, 50, '/assets/trufa-pistache.png'),
('Limão', 'Trufa cítrica e refrescante de limão', 4.00, 50, '/assets/trufa-limao.png');

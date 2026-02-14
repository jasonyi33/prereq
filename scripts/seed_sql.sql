-- Prereq Demo Seed SQL
-- Paste this into Supabase SQL Editor
-- Renames students to Alex/Jordan/Sam/Taylor and sets mastery profiles

-- 1. Rename students
UPDATE students SET name = 'Alex', email = 'alex@stanford.edu'
WHERE id = '156d05e5-1113-4e92-8afd-2a70a065ca66';

UPDATE students SET name = 'Jordan', email = 'jordan@stanford.edu'
WHERE id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6';

UPDATE students SET name = 'Sam', email = 'sam@stanford.edu'
WHERE id = 'db45fff0-7d01-491a-9c15-84ce656fa83d';

UPDATE students SET name = 'Taylor', email = 'taylor@stanford.edu'
WHERE id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3';

-- 2. Seed mastery for Alex (Strong — mostly green, some yellow gaps)
-- Alex: strong across the board, weaker on advanced unsupervised/RL topics
UPDATE student_mastery SET confidence = 0.85 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'e46c6bc1-622e-483b-8f1d-60b7a22b5f16'; -- linear_algebra
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'e3cf8cd3-ce2a-4402-9bba-af3d665e594c'; -- probability_stats
UPDATE student_mastery SET confidence = 0.85 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '7d2a3d63-81da-4b06-bdb2-0bda74a2ca42'; -- gradient_descent
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '9f08b693-b5a8-45cf-90b7-12b76bf46650'; -- linear_reg
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '43bd1914-ff01-467b-b723-55394888d3e2'; -- mle
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'fc647fe4-e977-4a76-8c1e-ae4a40e24335'; -- logistic_reg
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '47b9e08e-1b34-407a-a1c3-3ff8a411bc41'; -- glms
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '929a96b8-fb2a-4747-bdbe-0b278476d2b6'; -- gaussian_discriminant
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'b2ae8bb9-84fd-49ce-9b2b-c3a320b41ff5'; -- naive_bayes
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'e0bf061d-7c81-4bef-bd56-dfd5cc85a7df'; -- bias_variance
UPDATE student_mastery SET confidence = 0.50 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'c8f6eccb-1d55-4ef1-8048-ecfb37515d4c'; -- regularization
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '1cb7b24c-97bf-45ba-bfb5-2436f7587015'; -- cross_validation
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '8d007ba0-7b47-4249-86e9-5cf3455b6574'; -- kernels
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'f0c90472-8293-40ff-a759-f99533d9a993'; -- svm
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'da300619-3051-40c2-bde9-b880b26df332'; -- neural_networks
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '5038094e-814b-48a6-95b5-efdeee43ea7b'; -- backpropagation
UPDATE student_mastery SET confidence = 0.50 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'a3ae8021-a8c4-41d2-9345-d9566d9254e4'; -- deep_learning
UPDATE student_mastery SET confidence = 0.65 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '5683b2c1-98fd-4a25-85f6-c3364a96173a'; -- k_means
UPDATE student_mastery SET confidence = 0.60 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '651dec33-9693-46e7-95ac-0d3894e8962c'; -- em_algorithm
UPDATE student_mastery SET confidence = 0.55 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '71d01f20-66ae-446c-8ee8-7ffb05bd95a0'; -- mixture_models
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'b59b5d79-68f3-4a49-b909-3e90c92f24ac'; -- pca
UPDATE student_mastery SET confidence = 0.55 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '39b1ca3b-81e9-435a-944f-fbae4a78843d'; -- ica
UPDATE student_mastery SET confidence = 0.45 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'dda93e47-5c25-4f88-8efb-e5e15e194cfa'; -- self_supervised
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'f878ee05-fbe8-43fd-bd28-e195f308d4be'; -- mdps
UPDATE student_mastery SET confidence = 0.35 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = 'de16a230-3e0e-4fc9-a7f2-a314d2e21989'; -- value_policy_iteration
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '6d222b34-e95a-4478-9c91-c6ccecfcda43'; -- lqr
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = '156d05e5-1113-4e92-8afd-2a70a065ca66' AND concept_id = '329b13e3-3e42-4303-9575-e42aee9115fe'; -- policy_gradient

-- 3. Seed mastery for Jordan (Average — mix of green/yellow/red)
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'e46c6bc1-622e-483b-8f1d-60b7a22b5f16'; -- linear_algebra
UPDATE student_mastery SET confidence = 0.65 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'e3cf8cd3-ce2a-4402-9bba-af3d665e594c'; -- probability_stats
UPDATE student_mastery SET confidence = 0.55 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '7d2a3d63-81da-4b06-bdb2-0bda74a2ca42'; -- gradient_descent
UPDATE student_mastery SET confidence = 0.60 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '9f08b693-b5a8-45cf-90b7-12b76bf46650'; -- linear_reg
UPDATE student_mastery SET confidence = 0.50 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '43bd1914-ff01-467b-b723-55394888d3e2'; -- mle
UPDATE student_mastery SET confidence = 0.55 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'fc647fe4-e977-4a76-8c1e-ae4a40e24335'; -- logistic_reg
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '47b9e08e-1b34-407a-a1c3-3ff8a411bc41'; -- glms
UPDATE student_mastery SET confidence = 0.45 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '929a96b8-fb2a-4747-bdbe-0b278476d2b6'; -- gaussian_discriminant
UPDATE student_mastery SET confidence = 0.60 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'b2ae8bb9-84fd-49ce-9b2b-c3a320b41ff5'; -- naive_bayes
UPDATE student_mastery SET confidence = 0.35 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'e0bf061d-7c81-4bef-bd56-dfd5cc85a7df'; -- bias_variance
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'c8f6eccb-1d55-4ef1-8048-ecfb37515d4c'; -- regularization
UPDATE student_mastery SET confidence = 0.45 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '1cb7b24c-97bf-45ba-bfb5-2436f7587015'; -- cross_validation
UPDATE student_mastery SET confidence = 0.35 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '8d007ba0-7b47-4249-86e9-5cf3455b6574'; -- kernels
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'f0c90472-8293-40ff-a759-f99533d9a993'; -- svm
UPDATE student_mastery SET confidence = 0.25 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'da300619-3051-40c2-bde9-b880b26df332'; -- neural_networks
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '5038094e-814b-48a6-95b5-efdeee43ea7b'; -- backpropagation
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'a3ae8021-a8c4-41d2-9345-d9566d9254e4'; -- deep_learning
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '5683b2c1-98fd-4a25-85f6-c3364a96173a'; -- k_means
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '651dec33-9693-46e7-95ac-0d3894e8962c'; -- em_algorithm
UPDATE student_mastery SET confidence = 0.25 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '71d01f20-66ae-446c-8ee8-7ffb05bd95a0'; -- mixture_models
UPDATE student_mastery SET confidence = 0.50 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'b59b5d79-68f3-4a49-b909-3e90c92f24ac'; -- pca
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '39b1ca3b-81e9-435a-944f-fbae4a78843d'; -- ica
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'dda93e47-5c25-4f88-8efb-e5e15e194cfa'; -- self_supervised
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'f878ee05-fbe8-43fd-bd28-e195f308d4be'; -- mdps
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = 'de16a230-3e0e-4fc9-a7f2-a314d2e21989'; -- value_policy_iteration
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '6d222b34-e95a-4478-9c91-c6ccecfcda43'; -- lqr
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = '0ac0f4f5-53e2-46ce-be93-5968366b65e6' AND concept_id = '329b13e3-3e42-4303-9575-e42aee9115fe'; -- policy_gradient

-- 4. Seed mastery for Sam (Struggling — mostly red, some yellow, little green)
-- Sam is the live demo participant
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'e46c6bc1-622e-483b-8f1d-60b7a22b5f16'; -- linear_algebra
UPDATE student_mastery SET confidence = 0.45 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'e3cf8cd3-ce2a-4402-9bba-af3d665e594c'; -- probability_stats
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '7d2a3d63-81da-4b06-bdb2-0bda74a2ca42'; -- gradient_descent
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '9f08b693-b5a8-45cf-90b7-12b76bf46650'; -- linear_reg
UPDATE student_mastery SET confidence = 0.30 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '43bd1914-ff01-467b-b723-55394888d3e2'; -- mle
UPDATE student_mastery SET confidence = 0.35 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'fc647fe4-e977-4a76-8c1e-ae4a40e24335'; -- logistic_reg
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '47b9e08e-1b34-407a-a1c3-3ff8a411bc41'; -- glms
UPDATE student_mastery SET confidence = 0.25 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '929a96b8-fb2a-4747-bdbe-0b278476d2b6'; -- gaussian_discriminant
UPDATE student_mastery SET confidence = 0.35 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'b2ae8bb9-84fd-49ce-9b2b-c3a320b41ff5'; -- naive_bayes
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'e0bf061d-7c81-4bef-bd56-dfd5cc85a7df'; -- bias_variance
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'c8f6eccb-1d55-4ef1-8048-ecfb37515d4c'; -- regularization
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '1cb7b24c-97bf-45ba-bfb5-2436f7587015'; -- cross_validation
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '8d007ba0-7b47-4249-86e9-5cf3455b6574'; -- kernels
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'f0c90472-8293-40ff-a759-f99533d9a993'; -- svm
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'da300619-3051-40c2-bde9-b880b26df332'; -- neural_networks
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '5038094e-814b-48a6-95b5-efdeee43ea7b'; -- backpropagation
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'a3ae8021-a8c4-41d2-9345-d9566d9254e4'; -- deep_learning
UPDATE student_mastery SET confidence = 0.25 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '5683b2c1-98fd-4a25-85f6-c3364a96173a'; -- k_means
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '651dec33-9693-46e7-95ac-0d3894e8962c'; -- em_algorithm
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '71d01f20-66ae-446c-8ee8-7ffb05bd95a0'; -- mixture_models
UPDATE student_mastery SET confidence = 0.40 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'b59b5d79-68f3-4a49-b909-3e90c92f24ac'; -- pca
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '39b1ca3b-81e9-435a-944f-fbae4a78843d'; -- ica
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'dda93e47-5c25-4f88-8efb-e5e15e194cfa'; -- self_supervised
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'f878ee05-fbe8-43fd-bd28-e195f308d4be'; -- mdps
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = 'de16a230-3e0e-4fc9-a7f2-a314d2e21989'; -- value_policy_iteration
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '6d222b34-e95a-4478-9c91-c6ccecfcda43'; -- lqr
UPDATE student_mastery SET confidence = 0.05 WHERE student_id = 'db45fff0-7d01-491a-9c15-84ce656fa83d' AND concept_id = '329b13e3-3e42-4303-9575-e42aee9115fe'; -- policy_gradient

-- 5. Seed mastery for Taylor (Specific gaps — strong math, weak ML/NN)
UPDATE student_mastery SET confidence = 0.90 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'e46c6bc1-622e-483b-8f1d-60b7a22b5f16'; -- linear_algebra
UPDATE student_mastery SET confidence = 0.85 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'e3cf8cd3-ce2a-4402-9bba-af3d665e594c'; -- probability_stats
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '7d2a3d63-81da-4b06-bdb2-0bda74a2ca42'; -- gradient_descent
UPDATE student_mastery SET confidence = 0.85 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '9f08b693-b5a8-45cf-90b7-12b76bf46650'; -- linear_reg
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '43bd1914-ff01-467b-b723-55394888d3e2'; -- mle
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'fc647fe4-e977-4a76-8c1e-ae4a40e24335'; -- logistic_reg
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '47b9e08e-1b34-407a-a1c3-3ff8a411bc41'; -- glms
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '929a96b8-fb2a-4747-bdbe-0b278476d2b6'; -- gaussian_discriminant
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'b2ae8bb9-84fd-49ce-9b2b-c3a320b41ff5'; -- naive_bayes
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'e0bf061d-7c81-4bef-bd56-dfd5cc85a7df'; -- bias_variance
UPDATE student_mastery SET confidence = 0.65 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'c8f6eccb-1d55-4ef1-8048-ecfb37515d4c'; -- regularization
UPDATE student_mastery SET confidence = 0.80 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '1cb7b24c-97bf-45ba-bfb5-2436f7587015'; -- cross_validation
UPDATE student_mastery SET confidence = 0.70 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '8d007ba0-7b47-4249-86e9-5cf3455b6574'; -- kernels
UPDATE student_mastery SET confidence = 0.65 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'f0c90472-8293-40ff-a759-f99533d9a993'; -- svm
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'da300619-3051-40c2-bde9-b880b26df332'; -- neural_networks
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '5038094e-814b-48a6-95b5-efdeee43ea7b'; -- backpropagation
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'a3ae8021-a8c4-41d2-9345-d9566d9254e4'; -- deep_learning
UPDATE student_mastery SET confidence = 0.60 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '5683b2c1-98fd-4a25-85f6-c3364a96173a'; -- k_means
UPDATE student_mastery SET confidence = 0.55 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '651dec33-9693-46e7-95ac-0d3894e8962c'; -- em_algorithm
UPDATE student_mastery SET confidence = 0.50 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '71d01f20-66ae-446c-8ee8-7ffb05bd95a0'; -- mixture_models
UPDATE student_mastery SET confidence = 0.75 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'b59b5d79-68f3-4a49-b909-3e90c92f24ac'; -- pca
UPDATE student_mastery SET confidence = 0.60 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '39b1ca3b-81e9-435a-944f-fbae4a78843d'; -- ica
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'dda93e47-5c25-4f88-8efb-e5e15e194cfa'; -- self_supervised
UPDATE student_mastery SET confidence = 0.20 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'f878ee05-fbe8-43fd-bd28-e195f308d4be'; -- mdps
UPDATE student_mastery SET confidence = 0.15 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = 'de16a230-3e0e-4fc9-a7f2-a314d2e21989'; -- value_policy_iteration
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '6d222b34-e95a-4478-9c91-c6ccecfcda43'; -- lqr
UPDATE student_mastery SET confidence = 0.10 WHERE student_id = '1c1fdc3b-6836-46f3-bac6-d9bf5d4c8ee3' AND concept_id = '329b13e3-3e42-4303-9575-e42aee9115fe'; -- policy_gradient

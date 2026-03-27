-- ============================================================================
-- Seed 002: Test Data — Bihar Hardware Store
-- Hardware Store ERP
--
-- Realistic test data for a medium-level hardware shop in Bihar, India.
-- Includes 55+ products, 18 customers, 10 suppliers.
--
-- Run AFTER 001_admin_user.sql
-- ============================================================================


-- ============================================================
-- SUPPLIERS
-- ============================================================

INSERT INTO suppliers (name, phone, email, gstin, address, payment_terms) VALUES
('Shree Cement Distributors',      '9431012345', 'sales@shreecementdist.in',    '10AABCS1234A1Z5', '44, Gandhi Maidan Road, Patna - 800001',          '30 days credit'),
('Bihar Steel Corporation',        '9835012345', 'info@biharsteelcorp.in',      '10AABCB5678B1Z3', 'Industrial Area, Hajipur, Vaishali - 844101',     '15 days credit'),
('Colorworld Paints Agency',       '9472012345', 'orders@colorworldpatna.in',   '10AABCC9012C1Z1', 'Boring Road, Patna - 800001',                     '21 days credit'),
('Eastern Pipe & Fittings',        '9631012345', 'sales@easternpipe.co.in',     '10AABCE3456E1Z7', 'Saguna More, Patna - 800027',                     '30 days credit'),
('Magadh Electricals',             '9334012345', 'info@magadhelectricals.in',   '10AABCM7890M1Z5', 'Ashok Rajpath, Patna - 800004',                   '15 days credit'),
('Jharkhand Hardware Wholesale',   '9431098765', 'orders@jharkhardware.in',     '20AABCJ2345J1Z9', 'Bistupur Main Road, Jamshedpur - 831001',         '45 days credit'),
('Patliputra Plumbing House',      '7091012345', 'patliputraplumb@gmail.com',   '10AABCP6789P1Z3', 'Kankarbagh Main Road, Patna - 800020',            '21 days credit'),
('Ganges Waterproofing Solutions', '9155012345', 'gangeswp@gmail.com',          '10AABCG1234G1Z1', 'Dak Bungalow Road, Patna - 800001',               '30 days credit'),
('National Adhesive Depot',        '9905012345', 'nationaladhesive@yahoo.co.in','10AABCN8901N1Z6', 'Fraser Road, Patna - 800001',                     '15 days credit'),
('Samastipur Sanitary Mart',       '6201012345', 'ssmartpatna@gmail.com',       '10AABCS5678S1Z4', 'Rajendra Nagar, Patna - 800016',                  '30 days credit');


-- ============================================================
-- CUSTOMERS
-- ============================================================

-- Wholesale customers (with GSTIN & business names)
INSERT INTO customers (name, business_name, phone, address, city, pincode, gstin, type, credit_limit, outstanding_balance) VALUES
('Rajesh Kumar Singh',    'Singh Construction Pvt Ltd',     '9431056789', 'Near Mahavir Mandir, Exhibition Road',  'Patna',        '800001', '10AABCS2345R1Z8', 'wholesale', 500000.00, 125000.00),
('Mohammad Irfan',        'Irfan Builders & Developers',   '9835067890', 'Budha Colony, Bodhgaya Road',           'Gaya',         '823001', '10AABCI6789I1Z4', 'wholesale', 300000.00,  45000.00),
('Vikash Kumar Gupta',    'Gupta Hardware & Sanitary',      '7091078901', 'Mithanpura Chowk',                      'Muzaffarpur',  '842001', '10AABCG3456V1Z2', 'wholesale', 200000.00,  78500.00),
('Amit Kumar Sah',        'Sah Construction Company',       '9472089012', 'Tilkamanjhi Road',                      'Bhagalpur',    '812001', '10AABCA4567A1Z0', 'wholesale', 400000.00,      0.00),
('Sunil Yadav',           'Yadav Infrastructure Works',     '9334090123', 'Laheriasarai Road',                     'Darbhanga',    '846001', '10AABCY5678S1Z8', 'wholesale', 250000.00,  92000.00),

-- Both type (retail + wholesale)
('Deepak Sharma',         'Sharma Hardware Store',          '9631001234', 'Bihar Sharif Main Market',              'Bihar Sharif', '803101', '10AABCD7890D1Z6', 'both',      150000.00,  15000.00),
('Pappu Kumar',           'New Bihar Cement House',         '9155002345', 'Station Road',                          'Patna',        '800001', '10AABCN8901P1Z4', 'both',      200000.00,  67800.00);

-- Retail customers (no GSTIN)
INSERT INTO customers (name, phone, address, city, pincode, type, credit_limit, outstanding_balance) VALUES
('Sanjay Kumar',          '8271003456', 'Boring Road, Near ICICI Bank',         'Patna',        '800001', 'retail',  50000.00,   8500.00),
('Ravi Ranjan',           '7004004567', 'Keshri Nagar, Bailey Road',            'Patna',        '800014', 'retail',  30000.00,      0.00),
('Manish Kumar Jha',      '6201005678', 'Samanpura, Rajendra Nagar',            'Patna',        '800016', 'retail',  20000.00,   3200.00),
('Pintu Singh',           '9905006789', 'Mohalla Tola, Imamganj',               'Gaya',         '823001', 'retail',  15000.00,      0.00),
('Bablu Thakur',          '9431007890', 'Ward No 14, Rampur',                   'Muzaffarpur',  '842001', 'retail',  10000.00,   5600.00),
('Dinesh Prasad',         '7488008901', 'Adampur Colony',                       'Bhagalpur',    '812001', 'retail',  25000.00,  12000.00),
('Mukesh Mandal',         '9572009012', 'Naya Mohalla, Bypass Road',            'Darbhanga',    '846001', 'retail',  10000.00,      0.00),
('Santosh Kumar Ram',     '8294010123', 'Mahendru Ghat Road',                   'Patna',        '800006', 'retail',  20000.00,   4500.00),
('Ranjeet Singh',         '6299011234', 'Nawada Road, Gobarsawan',              'Bihar Sharif', '803101', 'retail',      0.00,      0.00),
('Vijay Kumar Paswan',    '9608012345', 'Khajekalan, Phulwari Sharif',          'Patna',        '800002', 'retail',  10000.00,   1800.00),
('Arun Rai',              '7667013456', 'Chandmari Road, Bela',                 'Muzaffarpur',  '842001', 'retail',  15000.00,      0.00);


-- ============================================================
-- PRODUCTS
-- ============================================================

-- -----------------------------------------------
-- CEMENT  (HSN: 2523, GST: 28%)
-- -----------------------------------------------
INSERT INTO products (name, category, brand, sku, barcode, hsn_code, gst_rate, mrp, wholesale_price, purchase_price, current_stock, min_stock, unit) VALUES
('UltraTech PPC Cement 50kg',          'Cement', 'UltraTech',  'CEM-ULT-PPC-50',  '8901234560011', '2523', 28.00,  420.00,  395.00,  355.00,  250.000,  50.000, 'piece'),
('UltraTech OPC 43 Cement 50kg',       'Cement', 'UltraTech',  'CEM-ULT-OPC43-50','8901234560028', '2523', 28.00,  440.00,  410.00,  370.00,  120.000,  30.000, 'piece'),
('ACC Gold PPC Cement 50kg',           'Cement', 'ACC',        'CEM-ACC-PPC-50',  '8901234560035', '2523', 28.00,  410.00,  385.00,  345.00,  180.000,  40.000, 'piece'),
('Ambuja Plus Cement 50kg',            'Cement', 'Ambuja',     'CEM-AMB-PLS-50',  '8901234560042', '2523', 28.00,  415.00,  390.00,  350.00,  200.000,  50.000, 'piece'),
('Dalmia DSP Cement 50kg',             'Cement', 'Dalmia',     'CEM-DAL-DSP-50',  '8901234560059', '2523', 28.00,  400.00,  375.00,  340.00,   80.000,  25.000, 'piece'),

-- -----------------------------------------------
-- TMT STEEL BARS  (HSN: 7214, GST: 18%)
-- -----------------------------------------------
('TATA Tiscon 500D 8mm TMT Bar',       'Steel',  'TATA Tiscon','STL-TAT-8MM',     '8901234560066', '7214', 18.00,   62.00,   58.00,   52.00,  500.000, 100.000, 'kg'),
('TATA Tiscon 500D 10mm TMT Bar',      'Steel',  'TATA Tiscon','STL-TAT-10MM',    '8901234560073', '7214', 18.00,   61.00,   57.00,   51.50,  800.000, 150.000, 'kg'),
('TATA Tiscon 500D 12mm TMT Bar',      'Steel',  'TATA Tiscon','STL-TAT-12MM',    '8901234560080', '7214', 18.00,   60.00,   56.50,   51.00, 1000.000, 200.000, 'kg'),
('TATA Tiscon 500D 16mm TMT Bar',      'Steel',  'TATA Tiscon','STL-TAT-16MM',    '8901234560097', '7214', 18.00,   60.00,   56.00,   50.50,  600.000, 100.000, 'kg'),
('TATA Tiscon 500D 20mm TMT Bar',      'Steel',  'TATA Tiscon','STL-TAT-20MM',    '8901234560103', '7214', 18.00,   60.00,   56.00,   50.50,  400.000,  80.000, 'kg'),
('Kamdhenu NXT 500D 8mm TMT Bar',      'Steel',  'Kamdhenu',   'STL-KAM-8MM',     '8901234560110', '7214', 18.00,   58.00,   54.00,   48.00,  300.000,  80.000, 'kg'),
('Kamdhenu NXT 500D 12mm TMT Bar',     'Steel',  'Kamdhenu',   'STL-KAM-12MM',    '8901234560127', '7214', 18.00,   57.00,   53.00,   47.50,  500.000, 100.000, 'kg'),

-- -----------------------------------------------
-- PAINT  (HSN: 3209/3210, GST: 28%)
-- -----------------------------------------------
('Asian Paints Tractor Emulsion 20L',   'Paint',  'Asian Paints','PNT-AP-TREM-20', '8901234560134', '3209', 28.00, 4350.00, 3950.00, 3550.00,   25.000,   5.000, 'piece'),
('Asian Paints Tractor Emulsion 10L',   'Paint',  'Asian Paints','PNT-AP-TREM-10', '8901234560141', '3209', 28.00, 2300.00, 2100.00, 1880.00,   35.000,  10.000, 'piece'),
('Asian Paints Tractor Emulsion 4L',    'Paint',  'Asian Paints','PNT-AP-TREM-4',  '8901234560158', '3209', 28.00,  980.00,  890.00,  800.00,   50.000,  15.000, 'piece'),
('Asian Paints Apcolite Enamel 4L',     'Paint',  'Asian Paints','PNT-AP-ENAM-4',  '8901234560165', '3210', 28.00, 1350.00, 1220.00, 1100.00,   20.000,   5.000, 'piece'),
('Asian Paints Primer 20L',             'Paint',  'Asian Paints','PNT-AP-PRIM-20', '8901234560172', '3209', 28.00, 3200.00, 2900.00, 2600.00,   15.000,   5.000, 'piece'),
('Berger WeatherCoat Smooth 20L',       'Paint',  'Berger',     'PNT-BR-WCS-20',  '8901234560189', '3209', 28.00, 4200.00, 3800.00, 3400.00,   18.000,   5.000, 'piece'),
('Berger Rangoli Distemper 20kg',        'Paint',  'Berger',     'PNT-BR-DIS-20',  '8901234560196', '3209', 28.00, 1650.00, 1500.00, 1350.00,   30.000,  10.000, 'piece'),
('Nerolac Excel Mica Marble 20L',       'Paint',  'Nerolac',    'PNT-NR-EMM-20',  '8901234560202', '3209', 28.00, 4500.00, 4100.00, 3680.00,   12.000,   3.000, 'piece'),

-- -----------------------------------------------
-- PVC PIPES & FITTINGS  (HSN: 3917, GST: 18%)
-- -----------------------------------------------
('Astral CPVC Pipe 1/2 inch 3m',       'Pipes',  'Astral',     'PIP-AST-CPVC-05', '8901234560219', '3917', 18.00,  285.00,  260.00,  232.00,  100.000,  25.000, 'piece'),
('Astral CPVC Pipe 3/4 inch 3m',       'Pipes',  'Astral',     'PIP-AST-CPVC-07', '8901234560226', '3917', 18.00,  420.00,  380.00,  340.00,   80.000,  20.000, 'piece'),
('Astral CPVC Pipe 1 inch 3m',         'Pipes',  'Astral',     'PIP-AST-CPVC-10', '8901234560233', '3917', 18.00,  650.00,  590.00,  530.00,   60.000,  15.000, 'piece'),
('Finolex PVC Pipe 1 inch 6m',         'Pipes',  'Finolex',    'PIP-FNX-PVC-10',  '8901234560240', '3917', 18.00,  480.00,  440.00,  395.00,   75.000,  20.000, 'piece'),
('Finolex PVC Pipe 2 inch 6m',         'Pipes',  'Finolex',    'PIP-FNX-PVC-20',  '8901234560257', '3917', 18.00,  820.00,  750.00,  675.00,   40.000,  10.000, 'piece'),
('Finolex PVC Pipe 4 inch 6m',         'Pipes',  'Finolex',    'PIP-FNX-PVC-40',  '8901234560264', '3917', 18.00, 1650.00, 1500.00, 1350.00,   25.000,   8.000, 'piece'),
('GI Pipe 1 inch 6m',                  'Pipes',  'Jindal',     'PIP-GI-10-6M',    '8901234560271', '7306', 18.00, 1200.00, 1100.00,  980.00,   30.000,  10.000, 'piece'),

-- -----------------------------------------------
-- ELECTRICAL — WIRE  (HSN: 8544, GST: 18%)
-- -----------------------------------------------
('Havells Lifeline 1.5 sqmm Wire 90m', 'Electrical','Havells', 'ELC-HAV-15-90',   '8901234560288', '8544', 18.00, 2350.00, 2150.00, 1920.00,   40.000,  10.000, 'piece'),
('Havells Lifeline 2.5 sqmm Wire 90m', 'Electrical','Havells', 'ELC-HAV-25-90',   '8901234560295', '8544', 18.00, 3850.00, 3520.00, 3150.00,   30.000,  10.000, 'piece'),
('Havells Lifeline 4 sqmm Wire 90m',   'Electrical','Havells', 'ELC-HAV-40-90',   '8901234560301', '8544', 18.00, 5850.00, 5350.00, 4800.00,   15.000,   5.000, 'piece'),
('Polycab FR 1.5 sqmm Wire 90m',       'Electrical','Polycab', 'ELC-POL-15-90',   '8901234560318', '8544', 18.00, 2250.00, 2050.00, 1830.00,   35.000,  10.000, 'piece'),
('Polycab FR 2.5 sqmm Wire 90m',       'Electrical','Polycab', 'ELC-POL-25-90',   '8901234560325', '8544', 18.00, 3650.00, 3350.00, 3000.00,   25.000,   8.000, 'piece'),

-- -----------------------------------------------
-- ELECTRICAL — SWITCHES/MCB  (HSN: 8536, GST: 18%)
-- -----------------------------------------------
('Anchor Roma 6A Switch',              'Electrical','Anchor',   'ELC-ANC-SW-6A',   '8901234560332', '8536', 18.00,   48.00,   38.00,   30.00,  200.000,  50.000, 'piece'),
('Anchor Roma 16A Switch',             'Electrical','Anchor',   'ELC-ANC-SW-16A',  '8901234560349', '8536', 18.00,   65.00,   52.00,   42.00,  150.000,  40.000, 'piece'),
('Anchor Roma 6A Socket',              'Electrical','Anchor',   'ELC-ANC-SK-6A',   '8901234560356', '8536', 18.00,   55.00,   44.00,   35.00,  150.000,  30.000, 'piece'),
('Havells 32A SP MCB',                 'Electrical','Havells',  'ELC-HAV-MCB-32',  '8901234560363', '8536', 18.00,  280.00,  250.00,  220.00,   60.000,  15.000, 'piece'),
('Havells 4-Way SPN DB',               'Electrical','Havells',  'ELC-HAV-DB-4W',   '8901234560370', '8537', 18.00,  650.00,  580.00,  510.00,   20.000,   5.000, 'piece'),

-- -----------------------------------------------
-- PLUMBING FITTINGS  (HSN: 3917/7412, GST: 18%)
-- -----------------------------------------------
('Astral CPVC Elbow 1/2 inch',         'Plumbing','Astral',    'PLB-AST-ELB-05',  '8901234560387', '3917', 18.00,   18.00,   14.00,   10.50,  300.000,  50.000, 'piece'),
('Astral CPVC Tee 1/2 inch',           'Plumbing','Astral',    'PLB-AST-TEE-05',  '8901234560394', '3917', 18.00,   22.00,   17.00,   12.50,  250.000,  50.000, 'piece'),
('Brass Ball Valve 1/2 inch',          'Plumbing','Generic',   'PLB-BRS-BV-05',   '8901234560400', '7412', 18.00,  280.00,  240.00,  195.00,   50.000,  15.000, 'piece'),
('Brass Ball Valve 3/4 inch',          'Plumbing','Generic',   'PLB-BRS-BV-07',   '8901234560417', '7412', 18.00,  420.00,  370.00,  310.00,   35.000,  10.000, 'piece'),
('Pillar Cock (Chrome) Full Turn',     'Plumbing','Jaquar',    'PLB-JAQ-PC-FT',   '8901234560424', '8481', 18.00,  850.00,  750.00,  640.00,   25.000,   5.000, 'piece'),

-- -----------------------------------------------
-- HARDWARE — NAILS/SCREWS  (HSN: 7317/7318, GST: 18%)
-- -----------------------------------------------
('Wire Nails 2 inch (1kg pack)',       'Hardware','Generic',   'HW-NAIL-2IN-1K',  '8901234560431', '7317', 18.00,   85.00,   72.00,   60.00,  100.000,  25.000, 'kg'),
('Wire Nails 3 inch (1kg pack)',       'Hardware','Generic',   'HW-NAIL-3IN-1K',  '8901234560448', '7317', 18.00,   80.00,   68.00,   57.00,   80.000,  20.000, 'kg'),
('Wood Screws Assorted Box (100pcs)',  'Hardware','Tata',      'HW-SCRW-AST-100', '8901234560455', '7318', 18.00,  180.00,  155.00,  130.00,   45.000,  10.000, 'box'),

-- -----------------------------------------------
-- HARDWARE — LOCKS/HANDLES  (HSN: 8301/8302, GST: 18%)
-- -----------------------------------------------
('Godrej Navtal 6 Lever Lock',        'Hardware','Godrej',    'HW-GDJ-NVT-6L',   '8901234560462', '8301', 18.00,  520.00,  460.00,  395.00,   30.000,  10.000, 'piece'),
('Godrej Ultra Padlock 65mm',         'Hardware','Godrej',    'HW-GDJ-ULT-65',   '8901234560479', '8301', 18.00,  380.00,  330.00,  280.00,   40.000,  10.000, 'piece'),
('SS Tower Bolt 8 inch',              'Hardware','Generic',   'HW-TB-SS-8IN',     '8901234560486', '8302', 18.00,  120.00,  100.00,   82.00,   60.000,  15.000, 'piece'),
('MS Door Handle 6 inch (pair)',      'Hardware','Generic',   'HW-DH-MS-6IN',     '8901234560493', '8302', 18.00,  220.00,  185.00,  150.00,   40.000,  10.000, 'piece'),
('SS Butt Hinge 4 inch (pair)',       'Hardware','Generic',   'HW-HNG-SS-4IN',    '8901234560509', '8302', 18.00,   95.00,   78.00,   62.00,  100.000,  25.000, 'piece'),

-- -----------------------------------------------
-- TOOLS  (HSN: 8205, GST: 18%)
-- -----------------------------------------------
('Claw Hammer Heavy Duty',            'Tools',  'Stanley',    'TL-STAN-CLHM',    '8901234560516', '8205', 18.00,  450.00,  390.00,  330.00,   20.000,   5.000, 'piece'),
('Combination Plier 8 inch',          'Tools',  'Taparia',    'TL-TAP-CPLR-8',   '8901234560523', '8205', 18.00,  350.00,  300.00,  255.00,   15.000,   5.000, 'piece'),
('Measuring Tape 5m/16ft',            'Tools',  'Freemans',   'TL-FM-MT-5M',     '8901234560530', '8205', 18.00,  250.00,  215.00,  180.00,   25.000,   8.000, 'piece'),
('Spirit Level 24 inch Aluminium',    'Tools',  'Generic',    'TL-SPL-AL-24',    '8901234560547', '8205', 18.00,  380.00,  330.00,  280.00,   10.000,   3.000, 'piece'),
('Hacksaw Frame Adjustable',          'Tools',  'Stanley',    'TL-STAN-HKSW',    '8901234560554', '8205', 18.00,  320.00,  275.00,  235.00,   12.000,   4.000, 'piece'),

-- -----------------------------------------------
-- WATERPROOFING  (HSN: 3214, GST: 18%)
-- -----------------------------------------------
('Dr. Fixit Pidiproof LW+ 1L',       'Waterproofing','Pidilite','WP-DRF-LW-1L',  '8901234560561', '3214', 18.00,  195.00,  170.00,  148.00,   40.000,  10.000, 'litre'),
('Dr. Fixit Pidiproof LW+ 5L',       'Waterproofing','Pidilite','WP-DRF-LW-5L',  '8901234560578', '3214', 18.00,  850.00,  750.00,  660.00,   20.000,   5.000, 'litre'),
('Dr. Fixit Newcoat 4L',              'Waterproofing','Pidilite','WP-DRF-NC-4L',  '8901234560585', '3214', 18.00, 1250.00, 1100.00,  970.00,   15.000,   4.000, 'litre'),

-- -----------------------------------------------
-- ADHESIVE  (HSN: 3506, GST: 18%)
-- -----------------------------------------------
('Fevicol SH 5kg',                    'Adhesive','Pidilite',  'ADH-FEV-SH-5K',   '8901234560592', '3506', 18.00,  850.00,  760.00,  670.00,   25.000,   8.000, 'piece'),
('Fevicol SH 1kg',                    'Adhesive','Pidilite',  'ADH-FEV-SH-1K',   '8901234560608', '3506', 18.00,  210.00,  185.00,  160.00,   50.000,  15.000, 'piece'),
('M-Seal Regular 100gm',              'Adhesive','Pidilite',  'ADH-MSL-REG-100',  '8901234560615', '3506', 18.00,   82.00,   70.00,   58.00,   60.000,  15.000, 'piece'),

-- -----------------------------------------------
-- SANITARY  (HSN: 6910/3505, GST: 18%)
-- -----------------------------------------------
('Hindware Wash Basin 18x12',         'Sanitary','Hindware',  'SAN-HW-WB-1812',  '8901234560622', '6910', 18.00, 1850.00, 1650.00, 1450.00,    8.000,   3.000, 'piece'),
('Hindware EWC Commode (S-Trap)',     'Sanitary','Hindware',  'SAN-HW-EWC-ST',   '8901234560639', '6910', 18.00, 5500.00, 4900.00, 4300.00,    5.000,   2.000, 'piece'),
('MYK Laticrete Tile Adhesive 20kg',  'Sanitary','MYK',      'SAN-MYK-TA-20',   '8901234560646', '3505', 18.00,  520.00,  470.00,  415.00,   30.000,  10.000, 'piece');

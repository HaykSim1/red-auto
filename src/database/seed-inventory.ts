/**
 * Demo stock for one shop: real aftermarket products (brand + catalogue
 * number) across the whole part taxonomy, with suppliers and a movement
 * history. Dev/demo only.
 *
 *   SEED_SHOP_PHONE=+37422222222 npm run seed:inventory
 *
 * Idempotent: an item with the same name, brand and part number is skipped.
 * Barcodes are synthetic EAN-13 codes in the GS1 in-store range (prefix 200),
 * not the manufacturers' real GTINs.
 */
import 'dotenv/config';
import { EntityManager, IsNull } from 'typeorm';
import { isKnownCategoryKey } from '../inventory/catalog/part-categories';
import { recordMovement } from '../inventory/movements';
import {
  normalizeOemNumbers,
  normalizePartNumber,
} from '../inventory/normalize';
import dataSource from './data-source';
import { generateCatalog } from './seed-inventory-catalog';
import {
  InventoryFitment,
  InventoryItem,
} from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventorySupplier } from './entities/inventory-supplier.entity';
import { User } from './entities/user.entity';
import {
  InventoryItemStatus,
  InventoryMovementType,
  OfferCondition,
} from './enums';

const SUPPLIERS = [
  {
    name: 'Autodoc Yerevan',
    phone: '+37410500100',
    telegram: null,
    note: 'Фильтры, тормоза, подвеска. Доставка на следующий день.',
  },
  {
    name: 'Emex Armenia',
    phone: '+37411700200',
    telegram: 'emex_am',
    note: 'Заказ из ОАЭ и Европы, 7–14 дней.',
  },
  {
    name: 'Liqui Moly Armenia',
    phone: '+37460400300',
    telegram: null,
    note: 'Масла и автохимия, опт от 5 канистр.',
  },
  {
    name: 'Разборка Аргаванд',
    phone: '+37493600400',
    telegram: null,
    note: 'Б/у кузов и оптика, только наличные.',
  },
  {
    name: 'GasTech',
    phone: '+37477800500',
    telegram: 'gastech_am',
    note: 'ГБО: редукторы, форсунки, баллоны.',
  },
] as const;

export type Fit = [
  make: string,
  model: string | null,
  from: number | null,
  to: number | null,
  engine?: string | null,
];

export interface Spec {
  cat: string;
  brand: string | null;
  pn: string | null;
  oem?: string[];
  ru: string;
  hy: string;
  en: string;
  fits?: Fit[];
  fitNote?: string;
  /** Sale price, AMD. Null = price on request. */
  price: number | null;
  /** Purchase cost per unit, AMD. */
  cost: number | null;
  /** Units received in total; the script then sells some of them. */
  stock: number;
  /** Units to sell out of `stock` (default: derived from a seeded RNG). */
  sold?: number;
  supplier?: number;
  shelf?: string;
  used?: boolean;
  draft?: boolean;
  note?: string;
}

const VAG_PQ35: Fit[] = [
  ['Volkswagen', 'Golf', 2003, 2013],
  ['Volkswagen', 'Jetta', 2005, 2011],
  ['Skoda', 'Octavia', 2004, 2013],
  ['Audi', 'A3', 2003, 2012],
];
const CAMRY40: Fit[] = [['Toyota', 'Camry', 2006, 2011, '2.4']];
const LADA: Fit[] = [
  ['Lada', 'Priora', 2007, 2018, '1.6'],
  ['Lada', 'Granta', 2011, null, '1.6'],
  ['Lada', 'Kalina', 2004, 2018, '1.6'],
];

const ITEMS: Spec[] = [
  // ── Engine: filters, belts, gaskets ──
  {
    cat: 'car_parts.engine_parts.oil_system',
    brand: 'MANN-FILTER',
    pn: 'W 712/95',
    oem: ['06A115561B'],
    ru: 'Масляный фильтр',
    hy: 'Յուղի ֆիլտր',
    en: 'Oil filter',
    fits: [
      ['Volkswagen', 'Golf', 1997, 2013, '1.6'],
      ['Skoda', 'Octavia', 1996, 2013, '1.6'],
    ],
    price: 3500,
    cost: 2200,
    stock: 24,
    supplier: 0,
    shelf: 'A1-01',
  },
  {
    cat: 'car_parts.engine_parts.oil_system',
    brand: 'MANN-FILTER',
    pn: 'HU 816 x',
    oem: ['11427541827', '11427566327'],
    ru: 'Масляный фильтр (вставка)',
    hy: 'Յուղի ֆիլտր (ներդիր)',
    en: 'Oil filter element',
    fits: [
      ['BMW', '3 Series', 2005, 2013],
      ['BMW', '5 Series', 2005, 2017],
      ['BMW', 'X5', 2006, 2013, '3.0'],
    ],
    price: 5500,
    cost: 3600,
    stock: 14,
    supplier: 0,
    shelf: 'A1-02',
  },
  {
    cat: 'car_parts.engine_parts.oil_system',
    brand: 'MANN-FILTER',
    pn: 'W 68/3',
    oem: ['90915YZZE1', '9091510001'],
    ru: 'Масляный фильтр',
    hy: 'Յուղի ֆիլտր',
    en: 'Oil filter',
    fits: [
      ['Toyota', 'Corolla', 2001, 2013, '1.6'],
      ['Toyota', 'Camry', 2001, 2011, '2.4'],
      ['Toyota', 'RAV4', 2000, 2012, '2.0'],
    ],
    price: 3200,
    cost: 2000,
    stock: 30,
    supplier: 0,
    shelf: 'A1-03',
  },
  {
    cat: 'car_parts.engine_parts.air_intake_and_throttle_bodies',
    brand: 'MANN-FILTER',
    pn: 'C 30 005',
    oem: ['04E129620A'],
    ru: 'Воздушный фильтр',
    hy: 'Օդի ֆիլտր',
    en: 'Air filter',
    fits: [
      ['Volkswagen', 'Golf', 2012, 2020, '1.4 TSI'],
      ['Skoda', 'Octavia', 2012, 2020, '1.4 TSI'],
      ['Audi', 'A3', 2012, 2020, '1.4 TFSI'],
    ],
    price: 7500,
    cost: 4900,
    stock: 10,
    supplier: 0,
    shelf: 'A2-01',
  },
  {
    cat: 'car_parts.engine_parts.belts_chains_and_tensioners',
    brand: 'Gates',
    pn: 'K015569XS',
    oem: ['06A198119'],
    ru: 'Комплект ремня ГРМ',
    hy: 'ԳԲՄ փոկի հավաքածու',
    en: 'Timing belt kit',
    fits: [
      ['Volkswagen', 'Golf', 1997, 2013, '1.6'],
      ['Skoda', 'Octavia', 1996, 2013, '1.6'],
    ],
    price: 32000,
    cost: 23500,
    stock: 5,
    supplier: 1,
    shelf: 'B1-01',
  },
  {
    cat: 'car_parts.engine_parts.belts_chains_and_tensioners',
    brand: 'INA',
    pn: '530 0550 10',
    oem: ['03L198119'],
    ru: 'Комплект ремня ГРМ',
    hy: 'ԳԲՄ փոկի հավաքածու',
    en: 'Timing belt kit',
    fits: [
      ['Volkswagen', 'Passat', 2008, 2015, '2.0 TDI'],
      ['Skoda', 'Octavia', 2008, 2015, '2.0 TDI'],
    ],
    price: 58000,
    cost: 44000,
    stock: 3,
    supplier: 1,
    shelf: 'B1-02',
  },
  {
    cat: 'car_parts.engine_parts.belts_chains_and_tensioners',
    brand: 'Gates',
    pn: '5521XS',
    oem: ['21080100604010'],
    ru: 'Ремень ГРМ',
    hy: 'ԳԲՄ փոկ',
    en: 'Timing belt',
    fits: [
      ['Lada', '2108', 1984, 2004],
      ['Lada', '2110', 1995, 2007, '1.5 8V'],
    ],
    price: 6500,
    cost: 4200,
    stock: 12,
    supplier: 0,
    shelf: 'B1-03',
  },
  {
    cat: 'car_parts.engine_parts.belts_chains_and_tensioners',
    brand: 'Gates',
    pn: '6PK1873',
    ru: 'Поликлиновой ремень 6PK1873',
    hy: 'Պոլիկլինային փոկ 6PK1873',
    en: 'V-ribbed belt 6PK1873',
    fitNote: 'Подбор по длине и числу ручьёв.',
    price: 7800,
    cost: 5200,
    stock: 8,
    supplier: 0,
    shelf: 'B1-04',
  },
  {
    cat: 'car_parts.engine_parts.gaskets_bearing_shells_and_seals',
    brand: 'Victor Reinz',
    pn: '71-31955-00',
    oem: ['06A103483D'],
    ru: 'Прокладка клапанной крышки',
    hy: 'Փականային կափարիչի միջադիր',
    en: 'Valve cover gasket',
    fits: [['Volkswagen', 'Golf', 1997, 2010, '1.6']],
    price: 4800,
    cost: 3000,
    stock: 9,
    supplier: 0,
    shelf: 'B2-01',
  },
  {
    cat: 'car_parts.engine_parts.turbochargers_and_intercoolers',
    brand: 'Garrett',
    pn: '713672-5006S',
    oem: ['038253019C'],
    ru: 'Турбокомпрессор',
    hy: 'Տուրբոկոմպրեսոր',
    en: 'Turbocharger',
    fits: [
      ['Volkswagen', 'Golf', 1998, 2005, '1.9 TDI'],
      ['Skoda', 'Octavia', 1998, 2010, '1.9 TDI'],
    ],
    price: 285000,
    cost: 228000,
    stock: 1,
    sold: 0,
    supplier: 1,
    shelf: 'F1-01',
    note: 'Под заказ ещё 2 шт., срок 10 дней.',
  },
  // ── Brakes ──
  {
    cat: 'car_parts.braking_systems.brake_pads_and_shoes',
    brand: 'TRW',
    pn: 'GDB1550',
    oem: ['1K0698151A'],
    ru: 'Тормозные колодки передние',
    hy: 'Արգելակային կոճղակներ, առջևի',
    en: 'Front brake pads',
    fits: VAG_PQ35,
    price: 18500,
    cost: 13200,
    stock: 12,
    supplier: 0,
    shelf: 'C1-01',
  },
  {
    cat: 'car_parts.braking_systems.brake_pads_and_shoes',
    brand: 'Brembo',
    pn: 'P 85 075',
    oem: ['1K0698151A'],
    ru: 'Тормозные колодки передние',
    hy: 'Արգելակային կոճղակներ, առջևի',
    en: 'Front brake pads',
    fits: VAG_PQ35,
    price: 24000,
    cost: 17800,
    stock: 6,
    supplier: 1,
    shelf: 'C1-02',
  },
  {
    cat: 'car_parts.braking_systems.brake_pads_and_shoes',
    brand: 'TRW',
    pn: 'GDB3429',
    oem: ['0446533450'],
    ru: 'Тормозные колодки передние',
    hy: 'Արգելակային կոճղակներ, առջևի',
    en: 'Front brake pads',
    fits: CAMRY40,
    price: 21000,
    cost: 15400,
    stock: 10,
    supplier: 0,
    shelf: 'C1-03',
  },
  {
    cat: 'car_parts.braking_systems.brake_discs_and_drums',
    brand: 'Brembo',
    pn: '09.9772.11',
    oem: ['1K0615301AA'],
    ru: 'Тормозной диск передний 288 мм',
    hy: 'Արգելակային սկավառակ, առջևի 288 մմ',
    en: 'Front brake disc 288 mm',
    fits: VAG_PQ35,
    price: 26000,
    cost: 19500,
    stock: 8,
    supplier: 1,
    shelf: 'C2-01',
    note: 'Цена за 1 шт.',
  },
  {
    cat: 'car_parts.braking_systems.brake_discs_and_drums',
    brand: 'Zimmermann',
    pn: '150.3403.20',
    oem: ['34116854998'],
    ru: 'Тормозной диск передний 300 мм',
    hy: 'Արգելակային սկավառակ, առջևի 300 մմ',
    en: 'Front brake disc 300 mm',
    fits: [['BMW', '3 Series', 2005, 2013]],
    price: 34000,
    cost: 26000,
    stock: 4,
    supplier: 1,
    shelf: 'C2-02',
    note: 'Цена за 1 шт.',
  },
  {
    cat: 'car_parts.braking_systems.abs_and_brake_sensors',
    brand: 'Bosch',
    pn: '0 986 594 000',
    oem: ['1K0927807'],
    ru: 'Датчик ABS задний',
    hy: 'ABS տվիչ, հետևի',
    en: 'Rear ABS sensor',
    fits: VAG_PQ35,
    price: 16500,
    cost: 11800,
    stock: 4,
    supplier: 0,
    shelf: 'C3-01',
  },
  {
    cat: 'car_parts.braking_systems.brake_hoses_and_lines',
    brand: 'TRW',
    pn: 'PHD946',
    ru: 'Тормозной шланг передний',
    hy: 'Արգելակային ճկափող, առջևի',
    en: 'Front brake hose',
    fits: VAG_PQ35,
    price: 6900,
    cost: 4500,
    stock: 6,
    supplier: 0,
    shelf: 'C3-02',
  },
  // ── Chassis / steering ──
  {
    cat: 'car_parts.chassis.shock_absorbers_and_struts',
    brand: 'Bilstein',
    pn: '22-131607',
    oem: ['1K0413031BE'],
    ru: 'Амортизатор передний B4',
    hy: 'Մեղմիչ, առջևի B4',
    en: 'Front shock absorber B4',
    fits: VAG_PQ35,
    price: 42000,
    cost: 32500,
    stock: 4,
    supplier: 1,
    shelf: 'D1-01',
  },
  {
    cat: 'car_parts.chassis.shock_absorbers_and_struts',
    brand: 'KYB',
    pn: '339024',
    oem: ['4851009R30'],
    ru: 'Амортизатор передний правый Excel-G',
    hy: 'Մեղմիչ, առջևի աջ Excel-G',
    en: 'Front right shock absorber Excel-G',
    fits: CAMRY40,
    price: 38000,
    cost: 29000,
    stock: 2,
    supplier: 1,
    shelf: 'D1-02',
  },
  {
    cat: 'car_parts.chassis.wheel_bearings_and_hubs',
    brand: 'SKF',
    pn: 'VKBA 3643',
    oem: ['1T0498621'],
    ru: 'Ступица с подшипником передняя',
    hy: 'Անվակունդ առանցքակալով, առջևի',
    en: 'Front wheel bearing kit',
    fits: VAG_PQ35,
    price: 36000,
    cost: 27500,
    stock: 5,
    supplier: 0,
    shelf: 'D2-01',
  },
  {
    cat: 'car_parts.chassis.stabilizer_bars_and_links',
    brand: 'Meyle',
    pn: '116 060 0005',
    oem: ['1K0411315R'],
    ru: 'Стойка стабилизатора передняя',
    hy: 'Կայունարարի ձող, առջևի',
    en: 'Front stabilizer link',
    fits: VAG_PQ35,
    price: 7500,
    cost: 4800,
    stock: 14,
    supplier: 0,
    shelf: 'D2-02',
  },
  {
    cat: 'car_parts.chassis.control_arms_and_ball_joints',
    brand: 'Lemförder',
    pn: '29471 01',
    ru: 'Рычаг передней подвески',
    hy: 'Առջևի կախոցի լծակ',
    en: 'Front control arm',
    fits: VAG_PQ35,
    price: 31000,
    cost: 23800,
    stock: 3,
    supplier: 1,
    shelf: 'D3-01',
  },
  {
    cat: 'car_parts.chassis.cv_joints_and_driveshafts',
    brand: 'GKN',
    pn: '304643',
    ru: 'ШРУС наружный',
    hy: 'Արտաքին ՀԱԿՀ (գրանատ)',
    en: 'Outer CV joint',
    fits: [['Volkswagen', 'Golf', 2003, 2013, '1.6']],
    price: 28500,
    cost: 21000,
    stock: 2,
    supplier: 1,
    shelf: 'D3-02',
  },
  {
    cat: 'car_parts.steering_systems.tie_rods_and_ends',
    brand: 'TRW',
    pn: 'JTE1019',
    ru: 'Наконечник рулевой тяги',
    hy: 'Ղեկային ձողի ծայրակալ',
    en: 'Tie rod end',
    fits: VAG_PQ35,
    price: 9800,
    cost: 6700,
    stock: 7,
    supplier: 0,
    shelf: 'D4-01',
  },
  {
    cat: 'car_parts.transmission.clutch_kits_and_parts',
    brand: 'LuK',
    pn: '600 0016 00',
    oem: ['038105264H'],
    ru: 'Комплект сцепления с маховиком',
    hy: 'Կցորդիչի հավաքածու թափանիվով',
    en: 'Clutch kit with dual-mass flywheel',
    fits: [
      ['Volkswagen', 'Golf', 2003, 2010, '1.9 TDI'],
      ['Skoda', 'Octavia', 2004, 2010, '1.9 TDI'],
    ],
    price: 235000,
    cost: 189000,
    stock: 1,
    sold: 0,
    supplier: 1,
    shelf: 'F1-02',
  },
  // ── Cooling ──
  {
    cat: 'car_parts.cooling_and_heating_systems.water_pumps',
    brand: 'Aisin',
    pn: 'WPT-190',
    oem: ['1610028041'],
    ru: 'Водяной насос (помпа)',
    hy: 'Ջրի պոմպ',
    en: 'Water pump',
    fits: [
      ['Toyota', 'Camry', 2001, 2011, '2.4'],
      ['Toyota', 'RAV4', 2003, 2012, '2.4'],
    ],
    price: 27000,
    cost: 20500,
    stock: 3,
    supplier: 1,
    shelf: 'E1-01',
  },
  {
    cat: 'car_parts.cooling_and_heating_systems.thermostats',
    brand: 'Mahle',
    pn: 'TX 15 87D',
    oem: ['050121113C'],
    ru: 'Термостат 87 °C',
    hy: 'Թերմոստատ 87 °C',
    en: 'Thermostat 87 °C',
    fits: [
      ['Volkswagen', 'Golf', 1991, 2010, '1.6'],
      ['Skoda', 'Octavia', 1996, 2010, '1.6'],
    ],
    price: 5200,
    cost: 3300,
    stock: 9,
    supplier: 0,
    shelf: 'E1-02',
  },
  {
    cat: 'car_parts.cooling_and_heating_systems.radiators',
    brand: 'Nissens',
    pn: '65277A',
    oem: ['1K0121251AT'],
    ru: 'Радиатор охлаждения двигателя',
    hy: 'Շարժիչի հովացման ռադիատոր',
    en: 'Engine cooling radiator',
    fits: VAG_PQ35,
    price: 46000,
    cost: 35500,
    stock: 2,
    supplier: 1,
    shelf: 'E2-01',
  },
  {
    cat: 'car_parts.cooling_and_heating_systems.other',
    brand: 'MANN-FILTER',
    pn: 'CUK 2939',
    oem: ['1K1819653B'],
    ru: 'Салонный фильтр угольный',
    hy: 'Սրահի ածխային ֆիլտր',
    en: 'Cabin filter, activated carbon',
    fits: VAG_PQ35,
    price: 8500,
    cost: 5600,
    stock: 16,
    supplier: 0,
    shelf: 'A2-02',
  },
  // ── Electrical / ignition ──
  {
    cat: 'car_parts.electrical_systems.ignition_coils_and_spark_plugs',
    brand: 'NGK',
    pn: 'BKR6E-11',
    ru: 'Свеча зажигания',
    hy: 'Վառոցքի մոմ',
    en: 'Spark plug',
    fitNote: 'Toyota, Honda, Nissan, Mitsubishi — бензин, зазор 1.1 мм.',
    price: 1800,
    cost: 1100,
    stock: 48,
    supplier: 0,
    shelf: 'G1-01',
  },
  {
    cat: 'car_parts.electrical_systems.ignition_coils_and_spark_plugs',
    brand: 'Denso',
    pn: 'IK20',
    ru: 'Свеча зажигания иридиевая',
    hy: 'Վառոցքի մոմ, իրիդիումային',
    en: 'Iridium spark plug',
    fitNote: 'Универсальная иридиевая, калильное число 20.',
    price: 5500,
    cost: 3800,
    stock: 24,
    supplier: 1,
    shelf: 'G1-02',
  },
  {
    cat: 'car_parts.electrical_systems.ignition_coils_and_spark_plugs',
    brand: 'Bosch',
    pn: '0 242 235 666',
    ru: 'Свеча зажигания FR7DC+',
    hy: 'Վառոցքի մոմ FR7DC+',
    en: 'Spark plug FR7DC+',
    fits: [
      ['Volkswagen', 'Golf', 1997, 2010, '1.6'],
      ['Opel', 'Astra', 1998, 2010, '1.6'],
    ],
    price: 1600,
    cost: 950,
    stock: 40,
    supplier: 0,
    shelf: 'G1-03',
  },
  {
    cat: 'car_parts.electrical_systems.ignition_coils_and_spark_plugs',
    brand: 'Bosch',
    pn: '0 221 604 115',
    oem: ['07K905715F'],
    ru: 'Катушка зажигания',
    hy: 'Վառոցքի կոճ',
    en: 'Ignition coil',
    fits: [
      ['Volkswagen', 'Golf', 2004, 2013, '1.4 TSI'],
      ['Audi', 'A4', 2004, 2015, '2.0 TFSI'],
      ['Skoda', 'Octavia', 2004, 2013, '1.8 TSI'],
    ],
    price: 17500,
    cost: 12600,
    stock: 8,
    supplier: 0,
    shelf: 'G1-04',
  },
  {
    cat: 'car_parts.electrical_systems.sensors',
    brand: 'Bosch',
    pn: '0 280 218 116',
    oem: ['21083113001020'],
    ru: 'Датчик массового расхода воздуха (ДМРВ)',
    hy: 'Օդի զանգվածային ծախսի տվիչ',
    en: 'Mass air flow sensor',
    fits: LADA,
    price: 29500,
    cost: 22800,
    stock: 3,
    supplier: 1,
    shelf: 'G2-01',
  },
  {
    cat: 'car_parts.electrical_systems.sensors',
    brand: 'Bosch',
    pn: '0 281 002 531',
    oem: ['038906461B'],
    ru: 'Датчик массового расхода воздуха (ДМРВ)',
    hy: 'Օդի զանգվածային ծախսի տվիչ',
    en: 'Mass air flow sensor',
    fits: [
      ['Volkswagen', 'Golf', 1998, 2010, '1.9 TDI'],
      ['Skoda', 'Octavia', 1998, 2010, '1.9 TDI'],
    ],
    price: 34000,
    cost: 26500,
    stock: 2,
    supplier: 1,
    shelf: 'G2-02',
  },
  {
    cat: 'car_parts.electrical_systems.alternators',
    brand: 'Bosch',
    pn: '0 986 041 500',
    oem: ['06F903023F'],
    ru: 'Генератор 140 А',
    hy: 'Գեներատոր 140 Ա',
    en: 'Alternator 140 A',
    fits: VAG_PQ35,
    price: 98000,
    cost: 78000,
    stock: 1,
    sold: 0,
    supplier: 1,
    shelf: 'F2-01',
  },
  {
    cat: 'car_parts.electrical_systems.starters',
    brand: 'Valeo',
    pn: '438170',
    ru: 'Стартер 1.1 кВт',
    hy: 'Մեկնարկիչ 1.1 կՎտ',
    en: 'Starter 1.1 kW',
    fits: [['Volkswagen', 'Golf', 2003, 2013, '1.6']],
    price: 72000,
    cost: 56000,
    stock: 1,
    sold: 1,
    supplier: 1,
    shelf: 'F2-02',
  },
  {
    cat: 'car_parts.exhaust_systems.lambda_sensors',
    brand: 'Bosch',
    pn: '0 258 006 537',
    oem: ['11180385001000'],
    ru: 'Лямбда-зонд (датчик кислорода)',
    hy: 'Լյամբդա զոնդ (թթվածնի տվիչ)',
    en: 'Lambda (oxygen) sensor',
    fits: LADA,
    price: 19500,
    cost: 14200,
    stock: 5,
    supplier: 0,
    shelf: 'G2-03',
  },
  {
    cat: 'car_parts.exhaust_systems.mufflers_and_resonators',
    brand: 'Bosal',
    pn: '233-357',
    ru: 'Глушитель задний',
    hy: 'Խլացուցիչ, հետևի',
    en: 'Rear muffler',
    fits: [['Volkswagen', 'Golf', 1997, 2005, '1.6']],
    price: 39000,
    cost: 29500,
    stock: 2,
    supplier: 1,
    shelf: 'H1-01',
  },
  // ── Fuel ──
  {
    cat: 'car_parts.fuel_systems.fuel_pumps',
    brand: 'Bosch',
    pn: '0 580 453 453',
    oem: ['21101139009'],
    ru: 'Топливный насос (электробензонасос)',
    hy: 'Վառելիքի պոմպ',
    en: 'Electric fuel pump',
    fits: LADA,
    price: 14500,
    cost: 10200,
    stock: 6,
    supplier: 0,
    shelf: 'G3-01',
  },
  {
    cat: 'car_parts.fuel_systems.injectors_and_rails',
    brand: 'Bosch',
    pn: '0 280 158 502',
    oem: ['21114113201020'],
    ru: 'Форсунка топливная',
    hy: 'Վառելիքի ներարկիչ',
    en: 'Fuel injector',
    fits: LADA,
    price: 11500,
    cost: 8300,
    stock: 8,
    supplier: 0,
    shelf: 'G3-02',
  },
  {
    cat: 'car_parts.fuel_systems.other',
    brand: 'MANN-FILTER',
    pn: 'WK 853/3 x',
    oem: ['1J0127401A'],
    ru: 'Топливный фильтр (дизель)',
    hy: 'Վառելիքի ֆիլտր (դիզել)',
    en: 'Fuel filter (diesel)',
    fits: [
      ['Volkswagen', 'Golf', 1997, 2006, '1.9 TDI'],
      ['Skoda', 'Octavia', 1996, 2010, '1.9 TDI'],
    ],
    price: 9500,
    cost: 6400,
    stock: 7,
    supplier: 0,
    shelf: 'A2-03',
  },
  // ── Lighting ──
  {
    cat: 'car_parts.lighting_and_optics.bulbs',
    brand: 'Osram',
    pn: '64210',
    ru: 'Лампа H7 12V 55W Original',
    hy: 'Լամպ H7 12V 55W Original',
    en: 'Bulb H7 12V 55W Original',
    price: 1900,
    cost: 1150,
    stock: 40,
    supplier: 0,
    shelf: 'J1-01',
  },
  {
    cat: 'car_parts.lighting_and_optics.bulbs',
    brand: 'Osram',
    pn: '64210NL-HCB',
    ru: 'Лампы H7 Night Breaker Laser, 2 шт.',
    hy: 'Լամպեր H7 Night Breaker Laser, 2 հատ',
    en: 'H7 Night Breaker Laser bulbs, pair',
    price: 14500,
    cost: 10400,
    stock: 6,
    supplier: 0,
    shelf: 'J1-02',
  },
  {
    cat: 'car_parts.lighting_and_optics.bulbs',
    brand: 'Osram',
    pn: '64193',
    ru: 'Лампа H4 12V 60/55W Original',
    hy: 'Լամպ H4 12V 60/55W Original',
    en: 'Bulb H4 12V 60/55W Original',
    price: 1700,
    cost: 1000,
    stock: 30,
    supplier: 0,
    shelf: 'J1-03',
  },
  {
    cat: 'car_parts.lighting_and_optics.bulbs',
    brand: 'Philips',
    pn: '85122VIC1',
    ru: 'Ксеноновая лампа D2S Vision 35W',
    hy: 'Քսենոնային լամպ D2S Vision 35W',
    en: 'Xenon bulb D2S Vision 35W',
    price: 21000,
    cost: 15500,
    stock: 4,
    supplier: 1,
    shelf: 'J1-04',
  },
  {
    cat: 'car_parts.lighting_and_optics.headlights',
    brand: 'Volkswagen',
    pn: '5K1 941 005',
    oem: ['5K1941005'],
    ru: 'Фара левая галогенная, оригинал',
    hy: 'Լուսարձակ, ձախ հալոգեն, օրիգինալ',
    en: 'Left halogen headlight, genuine',
    fits: [['Volkswagen', 'Golf', 2008, 2013]],
    price: 65000,
    cost: 42000,
    stock: 1,
    sold: 0,
    supplier: 3,
    shelf: 'K1-01',
    used: true,
    note: 'Б/у, стекло без трещин, одно крепление восстановлено.',
  },
  {
    cat: 'car_parts.lighting_and_optics.tail_lights',
    brand: 'Depo',
    pn: '212-19Q1L-UE',
    ru: 'Фонарь задний левый наружный',
    hy: 'Հետևի լապտեր, ձախ արտաքին',
    en: 'Left outer tail light',
    fits: [['Toyota', 'Camry', 2006, 2009]],
    price: 32000,
    cost: 23500,
    stock: 2,
    supplier: 1,
    shelf: 'K1-02',
  },
  // ── Body / glass / interior (mostly used) ──
  {
    cat: 'car_parts.body_parts.bumpers',
    brand: 'Toyota',
    pn: '52119-33955',
    oem: ['5211933955'],
    ru: 'Бампер передний, оригинал',
    hy: 'Առջևի թափարգել, օրիգինալ',
    en: 'Front bumper, genuine',
    fits: [['Toyota', 'Camry', 2006, 2009]],
    price: 85000,
    cost: 55000,
    stock: 1,
    sold: 0,
    supplier: 3,
    shelf: 'Склад-2',
    used: true,
    note: 'Б/у, под покраску, царапины снизу.',
  },
  {
    cat: 'car_parts.body_parts.mirrors',
    brand: 'TYC',
    pn: '337-0164',
    ru: 'Зеркало боковое левое, электро, с обогревом',
    hy: 'Կողային հայելի, ձախ, էլեկտրական, տաքացվող',
    en: 'Left door mirror, electric, heated',
    fits: [['Volkswagen', 'Golf', 2003, 2008]],
    price: 27000,
    cost: 19500,
    stock: 2,
    supplier: 1,
    shelf: 'K2-01',
  },
  {
    cat: 'car_parts.car_glass.windshields',
    brand: 'Pilkington',
    pn: '8580AGSMVZ',
    ru: 'Лобовое стекло с датчиком дождя',
    hy: 'Դիմապակի անձրևի տվիչով',
    en: 'Windshield with rain sensor',
    fits: [['Volkswagen', 'Golf', 2003, 2008]],
    price: null,
    cost: 48000,
    stock: 1,
    sold: 0,
    supplier: 1,
    shelf: 'Склад-2',
    note: 'Цена с установкой — по запросу.',
  },
  {
    cat: 'car_parts.car_interior.pedals_and_pads',
    brand: 'Febi Bilstein',
    pn: '05284',
    oem: ['321721173'],
    ru: 'Накладка педали тормоза',
    hy: 'Արգելակի ոտնակի վրադիր',
    en: 'Brake pedal pad',
    fits: [['Volkswagen', 'Golf', 1983, 2005]],
    price: 1500,
    cost: 800,
    stock: 10,
    supplier: 0,
    shelf: 'L1-01',
  },
  // ── Batteries ──
  {
    cat: 'car_batteries',
    brand: 'Varta',
    pn: '574 012 068',
    ru: 'Аккумулятор Blue Dynamic E11 74 А·ч 680 А',
    hy: 'Մարտկոց Blue Dynamic E11 74 Ա·ժ 680 Ա',
    en: 'Battery Blue Dynamic E11 74 Ah 680 A',
    price: 62000,
    cost: 49500,
    stock: 6,
    supplier: 1,
    shelf: 'M1-01',
  },
  {
    cat: 'car_batteries',
    brand: 'Varta',
    pn: '560 408 054',
    ru: 'Аккумулятор Blue Dynamic D24 60 А·ч 540 А',
    hy: 'Մարտկոց Blue Dynamic D24 60 Ա·ժ 540 Ա',
    en: 'Battery Blue Dynamic D24 60 Ah 540 A',
    price: 49000,
    cost: 38500,
    stock: 8,
    supplier: 1,
    shelf: 'M1-02',
  },
  {
    cat: 'car_batteries',
    brand: 'Varta',
    pn: '570 901 076',
    ru: 'Аккумулятор Silver Dynamic AGM E39 70 А·ч 760 А',
    hy: 'Մարտկոց Silver Dynamic AGM E39 70 Ա·ժ 760 Ա',
    en: 'Battery Silver Dynamic AGM E39 70 Ah 760 A',
    fitNote: 'Для автомобилей с системой Start-Stop.',
    price: 98000,
    cost: 79000,
    stock: 3,
    supplier: 1,
    shelf: 'M1-03',
  },
  {
    cat: 'car_batteries',
    brand: 'Bosch',
    pn: '0 092 S40 050',
    ru: 'Аккумулятор S4 005 60 А·ч 540 А',
    hy: 'Մարտկոց S4 005 60 Ա·ժ 540 Ա',
    en: 'Battery S4 005 60 Ah 540 A',
    price: 51000,
    cost: 40500,
    stock: 4,
    supplier: 1,
    shelf: 'M1-04',
  },
  // ── Oils and chemicals ──
  {
    cat: 'oils_and_chemicals.engine_oils',
    brand: 'Liqui Moly',
    pn: '8973',
    ru: 'Моторное масло Top Tec 4200 5W-30, 5 л',
    hy: 'Շարժիչի յուղ Top Tec 4200 5W-30, 5 լ',
    en: 'Engine oil Top Tec 4200 5W-30, 5 L',
    fitNote: 'VW 504.00/507.00, BMW Longlife-04, MB 229.51.',
    price: 36000,
    cost: 27500,
    stock: 18,
    supplier: 2,
    shelf: 'N1-01',
  },
  {
    cat: 'oils_and_chemicals.engine_oils',
    brand: 'Liqui Moly',
    pn: '9054',
    ru: 'Моторное масло Molygen New Generation 5W-40, 4 л',
    hy: 'Շարժիչի յուղ Molygen New Generation 5W-40, 4 լ',
    en: 'Engine oil Molygen New Generation 5W-40, 4 L',
    price: 29500,
    cost: 22500,
    stock: 12,
    supplier: 2,
    shelf: 'N1-02',
  },
  {
    cat: 'oils_and_chemicals.engine_oils',
    brand: 'Motul',
    pn: '102870',
    ru: 'Моторное масло 8100 X-cess 5W-40, 5 л',
    hy: 'Շարժիչի յուղ 8100 X-cess 5W-40, 5 լ',
    en: 'Engine oil 8100 X-cess 5W-40, 5 L',
    price: 33000,
    cost: 25800,
    stock: 10,
    supplier: 1,
    shelf: 'N1-03',
  },
  {
    cat: 'oils_and_chemicals.engine_oils',
    brand: 'Shell',
    pn: '550052679',
    ru: 'Моторное масло Helix Ultra 5W-40, 4 л',
    hy: 'Շարժիչի յուղ Helix Ultra 5W-40, 4 լ',
    en: 'Engine oil Helix Ultra 5W-40, 4 L',
    price: 24500,
    cost: 18900,
    stock: 20,
    supplier: 1,
    shelf: 'N1-04',
  },
  {
    cat: 'oils_and_chemicals.engine_oils',
    brand: 'Toyota',
    pn: '08880-80845',
    oem: ['0888080845'],
    ru: 'Моторное масло Toyota 5W-30, 5 л, оригинал',
    hy: 'Շարժիչի յուղ Toyota 5W-30, 5 լ, օրիգինալ',
    en: 'Genuine Toyota engine oil 5W-30, 5 L',
    price: 27000,
    cost: 20500,
    stock: 9,
    supplier: 1,
    shelf: 'N1-05',
  },
  {
    cat: 'oils_and_chemicals.antifreeze_and_cooling_liquids',
    brand: 'Liqui Moly',
    pn: '21145',
    ru: 'Антифриз-концентрат KFS 12+, 1 л',
    hy: 'Անտիֆրիզի խտանյութ KFS 12+, 1 լ',
    en: 'Coolant concentrate KFS 12+, 1 L',
    price: 5800,
    cost: 4100,
    stock: 22,
    supplier: 2,
    shelf: 'N2-01',
  },
  {
    cat: 'oils_and_chemicals.antifreeze_and_cooling_liquids',
    brand: 'Febi Bilstein',
    pn: '01381',
    ru: 'Антифриз G12 красный, концентрат 1.5 л',
    hy: 'Անտիֆրիզ G12 կարմիր, խտանյութ 1.5 լ',
    en: 'Coolant G12 red, concentrate 1.5 L',
    price: 6500,
    cost: 4500,
    stock: 15,
    supplier: 0,
    shelf: 'N2-02',
  },
  {
    cat: 'oils_and_chemicals.hydraulic_oils_and_fluids',
    brand: 'ATE',
    pn: '03.9901-6402.2',
    ru: 'Тормозная жидкость SL.6 DOT 4, 1 л',
    hy: 'Արգելակային հեղուկ SL.6 DOT 4, 1 լ',
    en: 'Brake fluid SL.6 DOT 4, 1 L',
    price: 6200,
    cost: 4300,
    stock: 14,
    supplier: 0,
    shelf: 'N2-03',
  },
  {
    cat: 'oils_and_chemicals.hydraulic_oils_and_fluids',
    brand: 'Toyota',
    pn: '08886-02305',
    oem: ['0888602305'],
    ru: 'Жидкость АКПП ATF WS, 4 л, оригинал',
    hy: 'ԱՓՏ հեղուկ ATF WS, 4 լ, օրիգինալ',
    en: 'Genuine ATF WS transmission fluid, 4 L',
    price: 31000,
    cost: 24000,
    stock: 6,
    supplier: 1,
    shelf: 'N2-04',
  },
  {
    cat: 'oils_and_chemicals.lubricants',
    brand: 'Liqui Moly',
    pn: '3510',
    ru: 'Смазка для ШРУС LM 47 с MoS2, 100 г',
    hy: 'Քսանյութ ՀԱԿՀ-ի համար LM 47 MoS2, 100 գ',
    en: 'CV joint grease LM 47 with MoS2, 100 g',
    price: 2900,
    cost: 1900,
    stock: 20,
    supplier: 2,
    shelf: 'N3-01',
  },
  {
    cat: 'oils_and_chemicals.car_shampoos',
    brand: 'Sonax',
    pn: '314300',
    ru: 'Автошампунь-концентрат, 1 л',
    hy: 'Ավտոշամպուն-խտանյութ, 1 լ',
    en: 'Car shampoo concentrate, 1 L',
    price: 4200,
    cost: 2900,
    stock: 12,
    supplier: 2,
    shelf: 'N3-02',
  },
  // ── Tires and rims ──
  {
    cat: 'wheels_and_tires.tires',
    brand: 'Michelin',
    pn: null,
    ru: 'Шина летняя Primacy 4 205/55 R16 91V',
    hy: 'Ամառային անվադող Primacy 4 205/55 R16 91V',
    en: 'Summer tire Primacy 4 205/55 R16 91V',
    price: 46000,
    cost: 38000,
    stock: 16,
    supplier: 1,
    shelf: 'Шины-1',
    note: 'Цена за 1 шт.',
  },
  {
    cat: 'wheels_and_tires.tires',
    brand: 'Hankook',
    pn: null,
    ru: 'Шина летняя Kinergy Eco 2 K435 195/65 R15 91H',
    hy: 'Ամառային անվադող Kinergy Eco 2 K435 195/65 R15 91H',
    en: 'Summer tire Kinergy Eco 2 K435 195/65 R15 91H',
    price: 29000,
    cost: 23500,
    stock: 20,
    supplier: 1,
    shelf: 'Шины-2',
    note: 'Цена за 1 шт.',
  },
  {
    cat: 'wheels_and_tires.tires',
    brand: 'Yokohama',
    pn: null,
    ru: 'Шина зимняя iceGUARD iG60 215/60 R16 95Q',
    hy: 'Ձմեռային անվադող iceGUARD iG60 215/60 R16 95Q',
    en: 'Winter tire iceGUARD iG60 215/60 R16 95Q',
    price: 44000,
    cost: 36000,
    stock: 12,
    supplier: 1,
    shelf: 'Шины-3',
    note: 'Цена за 1 шт.',
  },
  {
    cat: 'rims_and_hub_caps.rims',
    brand: 'Toyota',
    pn: '42611-33A10',
    oem: ['4261133A10'],
    ru: 'Диск литой R17 5x114.3, оригинал',
    hy: 'Ձուլածո անվահեծ R17 5x114.3, օրիգինալ',
    en: 'Alloy rim R17 5x114.3, genuine',
    fits: [['Toyota', 'Camry', 2011, 2017]],
    price: 55000,
    cost: 38000,
    stock: 4,
    sold: 0,
    supplier: 3,
    shelf: 'Шины-4',
    used: true,
    note: 'Б/у комплект 4 шт., без правок. Цена за 1 шт.',
  },
  // ── Accessories ──
  {
    cat: 'car_accessories.windshield_wipers',
    brand: 'Bosch',
    pn: '3 397 118 979',
    ru: 'Щётки стеклоочистителя Aerotwin A979S 600/475 мм',
    hy: 'Ապակեմաքրիչի խոզանակներ Aerotwin A979S 600/475 մմ',
    en: 'Wiper blades Aerotwin A979S 600/475 mm',
    fits: [
      ['Volkswagen', 'Golf', 2003, 2013],
      ['Volkswagen', 'Passat', 2005, 2015],
    ],
    price: 15500,
    cost: 11200,
    stock: 9,
    supplier: 0,
    shelf: 'P1-01',
  },
  {
    cat: 'car_accessories.windshield_wipers',
    brand: 'Bosch',
    pn: '3 397 007 297',
    ru: 'Щётки стеклоочистителя Aerotwin A297S 600/500 мм',
    hy: 'Ապակեմաքրիչի խոզանակներ Aerotwin A297S 600/500 մմ',
    en: 'Wiper blades Aerotwin A297S 600/500 mm',
    fits: [
      ['BMW', '3 Series', 2005, 2013],
      ['Audi', 'A4', 2007, 2015],
    ],
    price: 16500,
    cost: 12000,
    stock: 6,
    supplier: 0,
    shelf: 'P1-02',
  },
  {
    cat: 'car_accessories.pumps_and_compressors',
    brand: 'Berkut',
    pn: 'R15',
    ru: 'Автомобильный компрессор R15, 40 л/мин',
    hy: 'Ավտոմոբիլային կոմպրեսոր R15, 40 լ/րոպե',
    en: 'Car air compressor R15, 40 L/min',
    price: 34000,
    cost: 26500,
    stock: 4,
    supplier: 1,
    shelf: 'P2-01',
  },
  {
    cat: 'car_accessories.chargers_and_cables',
    brand: 'Baseus',
    pn: 'CCALL-YD01',
    ru: 'Автомобильное зарядное устройство 2×USB 30 Вт',
    hy: 'Ավտոմոբիլային լիցքավորիչ 2×USB 30 Վտ',
    en: 'Car charger 2×USB 30 W',
    price: 5500,
    cost: 3400,
    stock: 15,
    supplier: 1,
    shelf: 'P2-02',
  },
  // ── Electronics / audio ──
  {
    cat: 'car_electronics.dash_mounted_cameras',
    brand: '70mai',
    pn: 'A500S',
    ru: 'Видеорегистратор Dash Cam Pro Plus+ A500S',
    hy: 'Տեսագրանցիչ Dash Cam Pro Plus+ A500S',
    en: 'Dash Cam Pro Plus+ A500S',
    price: 42000,
    cost: 33500,
    stock: 5,
    supplier: 1,
    shelf: 'R1-01',
  },
  {
    cat: 'car_electronics.alarm_and_anti_theft_devices',
    brand: 'StarLine',
    pn: 'A93',
    ru: 'Автосигнализация A93 с автозапуском',
    hy: 'Ավտոազդանշանային համակարգ A93 ավտոմեկնարկով',
    en: 'Car alarm A93 with remote start',
    price: 68000,
    cost: 54000,
    stock: 3,
    supplier: 1,
    shelf: 'R1-02',
  },
  {
    cat: 'car_electronics.radar_detectors',
    brand: 'Neoline',
    pn: 'X-COP 7500S',
    ru: 'Радар-детектор X-COP 7500S с GPS',
    hy: 'Ռադար-դետեկտոր X-COP 7500S GPS-ով',
    en: 'Radar detector X-COP 7500S with GPS',
    price: 49000,
    cost: 39500,
    stock: 2,
    supplier: 1,
    shelf: 'R1-03',
    draft: true,
  },
  {
    cat: 'car_audio.car_audio_system',
    brand: 'Pioneer',
    pn: 'MVH-S120UB',
    ru: 'Автомагнитола 1 DIN, USB, AUX',
    hy: 'Ավտոմագնիտոլա 1 DIN, USB, AUX',
    en: 'Car stereo 1 DIN, USB, AUX',
    price: 28000,
    cost: 21500,
    stock: 4,
    supplier: 1,
    shelf: 'R2-01',
  },
  {
    cat: 'car_audio.car_acoustics_and_speakers',
    brand: 'Pioneer',
    pn: 'TS-A1670F',
    ru: 'Динамики коаксиальные 16 см, 320 Вт, пара',
    hy: 'Կոաքսիալ բարձրախոսներ 16 սմ, 320 Վտ, զույգ',
    en: 'Coaxial speakers 16 cm, 320 W, pair',
    price: 31000,
    cost: 24500,
    stock: 5,
    supplier: 1,
    shelf: 'R2-02',
  },
  {
    cat: 'car_audio.amplifiers_and_subwoofers',
    brand: 'Pioneer',
    pn: 'TS-WX130EA',
    ru: 'Сабвуфер активный компактный 160 Вт',
    hy: 'Ակտիվ կոմպակտ սաբվուֆեր 160 Վտ',
    en: 'Compact active subwoofer 160 W',
    price: 79000,
    cost: 64000,
    stock: 2,
    supplier: 1,
    shelf: 'R2-03',
  },
  // ── Gas equipment ──
  {
    cat: 'gas_equipment.gas_equipment_kits',
    brand: 'Tomasetto',
    pn: 'AT09 Alaska',
    ru: 'Редуктор ГБО пропан, до 140 л.с.',
    hy: 'Գազի ռեդուկտոր (պրոպան), մինչև 140 ձ.ուժ',
    en: 'LPG reducer, up to 140 hp',
    price: 39000,
    cost: 30500,
    stock: 5,
    supplier: 4,
    shelf: 'S1-01',
  },
  {
    cat: 'gas_equipment.control_modules',
    brand: 'AC STAG',
    pn: 'QBOX Basic',
    ru: 'Блок управления ГБО STAG-4 QBOX Basic, 4 цил.',
    hy: 'Գազի կառավարման բլոկ STAG-4 QBOX Basic, 4 մխոց',
    en: 'LPG ECU STAG-4 QBOX Basic, 4 cyl.',
    price: 74000,
    cost: 59000,
    stock: 3,
    supplier: 4,
    shelf: 'S1-02',
  },
  {
    cat: 'gas_equipment.gas_equipment_valves',
    brand: 'Valtek',
    pn: 'Type 30',
    ru: 'Рампа газовых форсунок, 4 цил., 3 Ом',
    hy: 'Գազի ներարկիչների ռամպա, 4 մխոց, 3 Օմ',
    en: 'LPG injector rail, 4 cyl., 3 Ohm',
    price: 27500,
    cost: 21000,
    stock: 6,
    supplier: 4,
    shelf: 'S1-03',
  },
  {
    cat: 'gas_equipment.gas_filters',
    brand: 'Certools',
    pn: 'F-781',
    ru: 'Фильтр газовый паровой фазы 12/12 мм',
    hy: 'Գազի ֆիլտր (գոլորշու փուլ) 12/12 մմ',
    en: 'LPG vapour phase filter 12/12 mm',
    price: 2800,
    cost: 1700,
    stock: 25,
    supplier: 4,
    shelf: 'S2-01',
  },
  {
    cat: 'gas_equipment.pressure_sensors',
    brand: 'AC STAG',
    pn: 'PS-02 Plus',
    ru: 'Датчик давления и вакуума (MAP) PS-02 Plus',
    hy: 'Ճնշման և վակուումի տվիչ (MAP) PS-02 Plus',
    en: 'Pressure and vacuum (MAP) sensor PS-02 Plus',
    price: 14500,
    cost: 10800,
    stock: 4,
    supplier: 4,
    shelf: 'S2-02',
  },
];

// ── helpers ──

/** Deterministic RNG, so two runs produce the same history. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** EAN-13 in the GS1 in-store range: `200` + 9-digit index + check digit. */
function inStoreEan13(index: number): string {
  const body = `200${String(index).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}

/** Generated rows added after the hand-written ITEMS (SEED_BULK_COUNT=0 to skip). */
const BULK_COUNT = Number(process.env.SEED_BULK_COUNT ?? 1000);

const DAY = 24 * 60 * 60 * 1000;

async function backdate(
  m: EntityManager,
  movement: InventoryMovement,
  at: Date,
): Promise<void> {
  await m
    .getRepository(InventoryMovement)
    .update({ id: movement.id }, { createdAt: at });
}

async function main(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_DANGEROUS_SEED !== 'true'
  ) {
    console.error(
      'Refusing to seed inventory with NODE_ENV=production (set ALLOW_DANGEROUS_SEED=true to override).',
    );
    process.exit(1);
  }
  const phone = process.env.SEED_SHOP_PHONE;
  if (!phone) {
    console.error('Set SEED_SHOP_PHONE to the seller account to fill.');
    process.exit(1);
  }
  const all = [...ITEMS, ...generateCatalog(BULK_COUNT)];
  for (const spec of all) {
    if (!isKnownCategoryKey(spec.cat)) {
      throw new Error(`Unknown category key: ${spec.cat}`);
    }
  }

  await dataSource.initialize();
  const shop = await dataSource
    .getRepository(User)
    .findOne({ where: { phone } });
  if (!shop) {
    console.error(`No user with phone ${phone}.`);
    process.exit(1);
  }
  const shopId = shop.id;
  const rand = mulberry32(20261120);
  const now = Date.now();
  let created = 0;
  let skipped = 0;
  let movements = 0;

  await dataSource.transaction(async (m) => {
    const supplierRepo = m.getRepository(InventorySupplier);
    const suppliers: InventorySupplier[] = [];
    for (const s of SUPPLIERS) {
      const existing = await supplierRepo.findOne({
        where: { shop: { id: shopId }, name: s.name, deletedAt: IsNull() },
      });
      suppliers.push(
        existing ??
          (await supplierRepo.save(
            supplierRepo.create({ shop: { id: shopId }, ...s }),
          )),
      );
    }

    const items = m.getRepository(InventoryItem);
    for (const [index, spec] of all.entries()) {
      // Consume the RNG for every spec so a re-run stays deterministic.
      const ageDays = 20 + Math.floor(rand() * 70);
      const sellShare = rand();
      const restock = rand() < 0.3;

      const exists = await items.findOne({
        where: {
          shop: { id: shopId },
          name: spec.ru,
          brand: spec.brand ?? IsNull(),
          partNumberNormalized: normalizePartNumber(spec.pn) ?? IsNull(),
        },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const fitments: InventoryFitment[] = (spec.fits ?? []).map(
        ([make, model, from, to, engine]) => ({
          make,
          model,
          year_from: from,
          year_to: to,
          engine: engine ?? null,
        }),
      );
      const receivedAt = new Date(now - ageDays * DAY);
      const item = await items.save(
        items.create({
          shop: { id: shopId },
          status: spec.draft
            ? InventoryItemStatus.DRAFT
            : InventoryItemStatus.ACTIVE,
          brand: spec.brand,
          partNumber: spec.pn,
          partNumberNormalized: normalizePartNumber(spec.pn),
          barcode: inStoreEan13(index + 1),
          oemNumbers: normalizeOemNumbers(spec.oem),
          name: spec.ru,
          nameHy: spec.hy,
          nameEn: spec.en,
          categoryKey: spec.cat,
          fitments,
          fitmentNote: spec.fitNote ?? null,
          condition: spec.used ? OfferCondition.USED : OfferCondition.NEW,
          priceAmount: spec.price === null ? null : String(spec.price),
          priceCurrency: 'AMD',
          supplier:
            spec.supplier === undefined ? null : suppliers[spec.supplier],
          shelfLocation: spec.shelf ?? null,
          note: spec.note ?? null,
          needsReview: [],
          quantity: 0,
          createdAt: receivedAt,
        } as unknown as Partial<InventoryItem>),
      );
      created++;

      const base = { shopId, userId: shopId };
      // Opening receipt, optionally split into two deliveries.
      const first =
        restock && spec.stock >= 4 ? Math.ceil(spec.stock / 2) : spec.stock;
      await backdate(
        m,
        await recordMovement(m, item, {
          ...base,
          type: InventoryMovementType.RECEIVE,
          delta: first,
          unitCost: spec.cost,
        }),
        receivedAt,
      );
      movements++;

      const toSell =
        spec.sold ??
        Math.min(spec.stock, Math.floor(spec.stock * sellShare * 0.7));
      let sold = 0;
      let clock = receivedAt.getTime();
      const step = (ageDays * DAY) / (toSell + 3);
      let restocked = first === spec.stock;
      while (sold < toSell) {
        clock += step * (0.5 + rand());
        if (!restocked && (item.quantity <= 1 || sold >= toSell / 2)) {
          await backdate(
            m,
            await recordMovement(m, item, {
              ...base,
              type: InventoryMovementType.RECEIVE,
              delta: spec.stock - first,
              unitCost: spec.cost,
              note: 'Повторная поставка',
            }),
            new Date(Math.min(clock, now - 60_000)),
          );
          movements++;
          restocked = true;
          clock += 60_000;
        }
        const qty = Math.min(
          item.quantity,
          toSell - sold,
          rand() < 0.2 ? 2 : 1,
        );
        await backdate(
          m,
          await recordMovement(m, item, {
            ...base,
            type: InventoryMovementType.SELL,
            delta: -qty,
          }),
          new Date(Math.min(clock, now - 30_000)),
        );
        movements++;
        sold += qty;
      }
      if (!restocked) {
        await backdate(
          m,
          await recordMovement(m, item, {
            ...base,
            type: InventoryMovementType.RECEIVE,
            delta: spec.stock - first,
            unitCost: spec.cost,
            note: 'Повторная поставка',
          }),
          new Date(now - 2 * DAY),
        );
        movements++;
      }
    }
  });

  console.log(
    `Shop ${phone}: ${created} items created, ${skipped} skipped (already there), ${movements} movements, ${SUPPLIERS.length} suppliers.`,
  );
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

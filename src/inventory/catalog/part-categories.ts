/**
 * PLACEHOLDER part taxonomy. Replace this file with the real list.
 * Leaf keys are `<group>.<leaf>`; every group ends with `<group>.other`.
 */
export type CategoryLabels = { hy: string; ru: string; en: string };

export interface PartCategory {
  key: string;
  labels: CategoryLabels;
}

export interface PartCategoryGroup extends PartCategory {
  children: PartCategory[];
}

export const OTHER_CATEGORY_KEY = 'other.other';

export const PART_CATEGORIES: readonly PartCategoryGroup[] = [
  {
    key: 'engine',
    labels: { hy: 'Շարժիչ', ru: 'Двигатель', en: 'Engine' },
    children: [
      {
        key: 'engine.pistons',
        labels: {
          hy: 'Մխոցներ և օղակներ',
          ru: 'Поршни и кольца',
          en: 'Pistons and rings',
        },
      },
      {
        key: 'engine.gaskets',
        labels: {
          hy: 'Միջադիրներ',
          ru: 'Прокладки двигателя',
          en: 'Engine gaskets',
        },
      },
      {
        key: 'engine.timing',
        labels: {
          hy: 'Գազաբաշխման ժապավեն/շղթա',
          ru: 'Ремень и цепь ГРМ',
          en: 'Timing belt and chain',
        },
      },
      {
        key: 'engine.mounts',
        labels: {
          hy: 'Շարժիչի կախոցներ',
          ru: 'Опоры двигателя',
          en: 'Engine mounts',
        },
      },
      {
        key: 'engine.belts',
        labels: {
          hy: 'Գոտիներ և ռոլիկներ',
          ru: 'Ремни и ролики',
          en: 'Drive belts and pulleys',
        },
      },
      { key: 'engine.other', labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' } },
    ],
  },
  {
    key: 'fuel_system',
    labels: {
      hy: 'Վառելիքի համակարգ',
      ru: 'Топливная система',
      en: 'Fuel system',
    },
    children: [
      {
        key: 'fuel_system.pump',
        labels: { hy: 'Վառելիքի պոմպ', ru: 'Топливный насос', en: 'Fuel pump' },
      },
      {
        key: 'fuel_system.injectors',
        labels: { hy: 'Լցակներ', ru: 'Форсунки', en: 'Injectors' },
      },
      {
        key: 'fuel_system.throttle',
        labels: {
          hy: 'Օդաթիթեղ',
          ru: 'Дроссельная заслонка',
          en: 'Throttle body',
        },
      },
      {
        key: 'fuel_system.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'cooling',
    labels: {
      hy: 'Հովացման համակարգ',
      ru: 'Система охлаждения',
      en: 'Cooling system',
    },
    children: [
      {
        key: 'cooling.radiator',
        labels: { hy: 'Ռադիատոր', ru: 'Радиатор', en: 'Radiator' },
      },
      {
        key: 'cooling.water_pump',
        labels: {
          hy: 'Ջրի պոմպ',
          ru: 'Водяной насос (помпа)',
          en: 'Water pump',
        },
      },
      {
        key: 'cooling.thermostat',
        labels: { hy: 'Թերմոստատ', ru: 'Термостат', en: 'Thermostat' },
      },
      {
        key: 'cooling.hoses',
        labels: {
          hy: 'Խողովակներ',
          ru: 'Патрубки и шланги',
          en: 'Hoses and pipes',
        },
      },
      {
        key: 'cooling.fan',
        labels: {
          hy: 'Օդափոխիչ',
          ru: 'Вентилятор радиатора',
          en: 'Radiator fan',
        },
      },
      {
        key: 'cooling.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'exhaust',
    labels: {
      hy: 'Արտանետման համակարգ',
      ru: 'Выхлопная система',
      en: 'Exhaust system',
    },
    children: [
      {
        key: 'exhaust.muffler',
        labels: { hy: 'Խլացուցիչ', ru: 'Глушитель', en: 'Muffler' },
      },
      {
        key: 'exhaust.catalytic',
        labels: {
          hy: 'Կատալիզատոր',
          ru: 'Катализатор',
          en: 'Catalytic converter',
        },
      },
      {
        key: 'exhaust.pipes',
        labels: {
          hy: 'Արտանետման խողովակներ',
          ru: 'Выхлопные трубы',
          en: 'Exhaust pipes',
        },
      },
      {
        key: 'exhaust.sensors',
        labels: { hy: 'Լամբդա զոնդ', ru: 'Лямбда-зонд', en: 'Oxygen sensor' },
      },
      {
        key: 'exhaust.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'transmission',
    labels: { hy: 'Փոխանցման տուփ', ru: 'Трансмиссия', en: 'Transmission' },
    children: [
      {
        key: 'transmission.clutch',
        labels: { hy: 'Կցորդիչ', ru: 'Сцепление', en: 'Clutch' },
      },
      {
        key: 'transmission.gearbox',
        labels: {
          hy: 'Փոխանցման տուփի մասեր',
          ru: 'Детали КПП',
          en: 'Gearbox parts',
        },
      },
      {
        key: 'transmission.cv_joints',
        labels: {
          hy: 'Հավասար արագությունների հոդեր (ШРУС)',
          ru: 'ШРУС',
          en: 'CV joints',
        },
      },
      {
        key: 'transmission.driveshaft',
        labels: {
          hy: 'Կարդանային լիսեռ',
          ru: 'Карданный вал',
          en: 'Driveshaft',
        },
      },
      {
        key: 'transmission.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'brakes',
    labels: { hy: 'Արգելակներ', ru: 'Тормоза', en: 'Brakes' },
    children: [
      {
        key: 'brakes.pads',
        labels: {
          hy: 'Արգելակի կոճղակներ',
          ru: 'Тормозные колодки',
          en: 'Brake pads',
        },
      },
      {
        key: 'brakes.discs',
        labels: {
          hy: 'Արգելակի սկավառակներ',
          ru: 'Тормозные диски',
          en: 'Brake discs',
        },
      },
      {
        key: 'brakes.calipers',
        labels: {
          hy: 'Արգելակի կալիպերներ',
          ru: 'Суппорты',
          en: 'Brake calipers',
        },
      },
      {
        key: 'brakes.hoses',
        labels: {
          hy: 'Արգելակի խողովակներ',
          ru: 'Тормозные шланги',
          en: 'Brake hoses',
        },
      },
      { key: 'brakes.other', labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' } },
    ],
  },
  {
    key: 'suspension',
    labels: { hy: 'Կախոց', ru: 'Подвеска', en: 'Suspension' },
    children: [
      {
        key: 'suspension.shock_absorbers',
        labels: {
          hy: 'Ամորտիզատորներ',
          ru: 'Амортизаторы',
          en: 'Shock absorbers',
        },
      },
      {
        key: 'suspension.springs',
        labels: { hy: 'Զսպանակներ', ru: 'Пружины', en: 'Springs' },
      },
      {
        key: 'suspension.control_arms',
        labels: { hy: 'Լծակներ', ru: 'Рычаги', en: 'Control arms' },
      },
      {
        key: 'suspension.bushings',
        labels: {
          hy: 'Ռետինե հենակներ (սալենբլոկ)',
          ru: 'Сайлентблоки',
          en: 'Bushings',
        },
      },
      {
        key: 'suspension.stabilizer',
        labels: {
          hy: 'Կայունացուցիչ',
          ru: 'Стабилизатор',
          en: 'Stabilizer link and bar',
        },
      },
      {
        key: 'suspension.wheel_bearings',
        labels: {
          hy: 'Անիվի առանցքակալներ',
          ru: 'Ступичные подшипники',
          en: 'Wheel bearings',
        },
      },
      {
        key: 'suspension.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'steering',
    labels: {
      hy: 'Ղեկային համակարգ',
      ru: 'Рулевое управление',
      en: 'Steering',
    },
    children: [
      {
        key: 'steering.rack',
        labels: {
          hy: 'Ղեկային ռեյկա',
          ru: 'Рулевая рейка',
          en: 'Steering rack',
        },
      },
      {
        key: 'steering.tie_rods',
        labels: {
          hy: 'Ղեկային ձողեր և ծայրակալներ',
          ru: 'Рулевые тяги и наконечники',
          en: 'Tie rods and ends',
        },
      },
      {
        key: 'steering.pump',
        labels: {
          hy: 'Ղեկի ուժեղարար',
          ru: 'Насос ГУР',
          en: 'Power steering pump',
        },
      },
      {
        key: 'steering.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'electrical',
    labels: { hy: 'Էլեկտրական համակարգ', ru: 'Электрика', en: 'Electrical' },
    children: [
      {
        key: 'electrical.battery',
        labels: { hy: 'Ակումուլյատոր', ru: 'Аккумулятор', en: 'Battery' },
      },
      {
        key: 'electrical.starter',
        labels: { hy: 'Ստարտեր', ru: 'Стартер', en: 'Starter' },
      },
      {
        key: 'electrical.alternator',
        labels: { hy: 'Գեներատոր', ru: 'Генератор', en: 'Alternator' },
      },
      {
        key: 'electrical.sensors',
        labels: { hy: 'Սենսորներ', ru: 'Датчики', en: 'Sensors' },
      },
      {
        key: 'electrical.wiring',
        labels: { hy: 'Էլեկտրահաղորդալարեր', ru: 'Проводка', en: 'Wiring' },
      },
      {
        key: 'electrical.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'ignition',
    labels: { hy: 'Բռնկում', ru: 'Зажигание', en: 'Ignition' },
    children: [
      {
        key: 'ignition.spark_plugs',
        labels: { hy: 'Մոմեր', ru: 'Свечи зажигания', en: 'Spark plugs' },
      },
      {
        key: 'ignition.coils',
        labels: {
          hy: 'Բոցակալման կոճեր',
          ru: 'Катушки зажигания',
          en: 'Ignition coils',
        },
      },
      {
        key: 'ignition.glow_plugs',
        labels: { hy: 'Շիկացման մոմեր', ru: 'Свечи накала', en: 'Glow plugs' },
      },
      {
        key: 'ignition.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'body',
    labels: { hy: 'Թափք', ru: 'Кузов', en: 'Body' },
    children: [
      {
        key: 'body.bumpers',
        labels: { hy: 'Բամպերներ', ru: 'Бамперы', en: 'Bumpers' },
      },
      {
        key: 'body.fenders',
        labels: { hy: 'Թևեր', ru: 'Крылья', en: 'Fenders' },
      },
      {
        key: 'body.hood_doors',
        labels: {
          hy: 'Կափարիչ և դռներ',
          ru: 'Капот и двери',
          en: 'Hood and doors',
        },
      },
      {
        key: 'body.mirrors',
        labels: { hy: 'Հայելիներ', ru: 'Зеркала', en: 'Mirrors' },
      },
      {
        key: 'body.glass',
        labels: { hy: 'Ապակիներ', ru: 'Стёкла', en: 'Glass' },
      },
      { key: 'body.other', labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' } },
    ],
  },
  {
    key: 'interior',
    labels: { hy: 'Սրահ', ru: 'Салон', en: 'Interior' },
    children: [
      {
        key: 'interior.seats',
        labels: { hy: 'Նստատեղեր', ru: 'Сиденья', en: 'Seats' },
      },
      {
        key: 'interior.dashboard',
        labels: { hy: 'Վահանակ', ru: 'Панель приборов', en: 'Dashboard' },
      },
      {
        key: 'interior.controls',
        labels: {
          hy: 'Կառավարման կոճակներ',
          ru: 'Кнопки и переключатели',
          en: 'Controls and switches',
        },
      },
      {
        key: 'interior.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'lighting',
    labels: { hy: 'Լուսավորություն', ru: 'Освещение', en: 'Lighting' },
    children: [
      {
        key: 'lighting.headlights',
        labels: { hy: 'Գլխավոր լուսարձակներ', ru: 'Фары', en: 'Headlights' },
      },
      {
        key: 'lighting.tail_lights',
        labels: {
          hy: 'Հետևի լուսարձակներ',
          ru: 'Задние фонари',
          en: 'Tail lights',
        },
      },
      {
        key: 'lighting.bulbs',
        labels: { hy: 'Լամպեր', ru: 'Лампы', en: 'Bulbs' },
      },
      {
        key: 'lighting.fog_lights',
        labels: {
          hy: 'Մառախլապաշտպան լույսեր',
          ru: 'Противотуманные фары',
          en: 'Fog lights',
        },
      },
      {
        key: 'lighting.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'filters',
    labels: { hy: 'Ֆիլտրեր', ru: 'Фильтры', en: 'Filters' },
    children: [
      {
        key: 'filters.oil',
        labels: { hy: 'Յուղի ֆիլտր', ru: 'Масляный фильтр', en: 'Oil filter' },
      },
      {
        key: 'filters.air',
        labels: { hy: 'Օդի ֆիլտր', ru: 'Воздушный фильтр', en: 'Air filter' },
      },
      {
        key: 'filters.fuel',
        labels: {
          hy: 'Վառելիքի ֆիլտր',
          ru: 'Топливный фильтр',
          en: 'Fuel filter',
        },
      },
      {
        key: 'filters.cabin',
        labels: {
          hy: 'Սրահի ֆիլտր',
          ru: 'Салонный фильтр',
          en: 'Cabin filter',
        },
      },
      {
        key: 'filters.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'fluids',
    labels: {
      hy: 'Յուղեր և հեղուկներ',
      ru: 'Масла и жидкости',
      en: 'Oils and fluids',
    },
    children: [
      {
        key: 'fluids.engine_oil',
        labels: { hy: 'Շարժիչի յուղ', ru: 'Моторное масло', en: 'Engine oil' },
      },
      {
        key: 'fluids.transmission_oil',
        labels: {
          hy: 'Փոխանցման տուփի յուղ',
          ru: 'Трансмиссионное масло',
          en: 'Transmission oil',
        },
      },
      {
        key: 'fluids.coolant',
        labels: { hy: 'Հակասառեցնող հեղուկ', ru: 'Антифриз', en: 'Coolant' },
      },
      {
        key: 'fluids.brake_fluid',
        labels: {
          hy: 'Արգելակի հեղուկ',
          ru: 'Тормозная жидкость',
          en: 'Brake fluid',
        },
      },
      { key: 'fluids.other', labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' } },
    ],
  },
  {
    key: 'accessories',
    labels: { hy: 'Աքսեսուարներ', ru: 'Аксессуары', en: 'Accessories' },
    children: [
      {
        key: 'accessories.floor_mats',
        labels: { hy: 'Գորգիկներ', ru: 'Коврики', en: 'Floor mats' },
      },
      {
        key: 'accessories.wipers',
        labels: {
          hy: 'Մաքրիչներ',
          ru: 'Щётки стеклоочистителя',
          en: 'Wiper blades',
        },
      },
      {
        key: 'accessories.tow_roof',
        labels: {
          hy: 'Քարշակ և տանիքի բեռնակիր',
          ru: 'Фаркоп и багажник',
          en: 'Tow bar and roof rack',
        },
      },
      {
        key: 'accessories.other',
        labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
      },
    ],
  },
  {
    key: 'other',
    labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' },
    children: [
      { key: 'other.other', labels: { hy: 'Այլ', ru: 'Прочее', en: 'Other' } },
    ],
  },
];

export function leafCategoryKeys(): string[] {
  return PART_CATEGORIES.flatMap((g) => g.children.map((c) => c.key));
}

export function isKnownCategoryKey(key: string): boolean {
  return leafCategoryKeys().includes(key);
}

/** One line per leaf, for the recognition prompt. */
export function categoryPromptLines(): string[] {
  return PART_CATEGORIES.flatMap((g) =>
    g.children.map((c) => `${c.key} — ${c.labels.en} (${c.labels.ru})`),
  );
}

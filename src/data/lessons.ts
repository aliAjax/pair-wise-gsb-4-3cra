// 课文资料：课文原文、拆分片段、朗读提示、班级名单。只提供数据，不含判定逻辑。
import { splitLessonText } from '../domain/relay';
import type { Lesson, Student } from '../domain/types';

function buildLesson(
  id: string,
  title: string,
  author: string,
  grade: string,
  source: string,
  rawText: string,
  hints: string[],
): Lesson {
  const parts = splitLessonText(rawText);
  return {
    id,
    title,
    author,
    grade,
    source,
    rawText,
    segments: parts.map((text, i) => ({
      id: `${id}-s${i + 1}`,
      order: i + 1,
      text,
      hint: hints[i] ?? '读准字音，声音洪亮，节奏自然。',
    })),
  };
}

export const LESSONS: Lesson[] = [
  buildLesson(
    'l1',
    '观潮（节选）',
    '赵宗成、朱明元',
    '四年级上册',
    '人教版语文课文',
    '钱塘江大潮，自古以来被称为天下奇观。农历八月十八是一年一度的观潮日。这一天早上，我们来到了海宁市的盐官镇，据说这里是观潮最好的地方。我们随着观潮的人群，登上了海塘大堤。宽阔的钱塘江横卧在眼前。',
    [
      '“天下奇观”要读出赞叹的语气。',
      '“一年一度”稍作停顿，突出期待感。',
      '地名“海宁市”“盐官镇”读清楚，不抢拍。',
      '“随着”“登上”连贯一些，像真的在走动。',
      '“横卧”放慢语速，读出江面的开阔。',
    ],
  ),
  buildLesson(
    'l2',
    '荷塘月色（节选）',
    '朱自清',
    '高中必修',
    '统编版语文课文',
    '曲曲折折的荷塘上面，弥望的是田田的叶子。叶子出水很高，像亭亭的舞女的裙。层层的叶子中间，零星地点缀着些白花，有袅娜地开着的，有羞涩地打着朵儿的。正如一粒粒的明珠，又如碧天里的星星，又如刚出浴的美人。',
    [
      '叠词“曲曲折折”“田田”读得轻快舒展。',
      '比喻“舞女的裙”语调上扬，读出画面。',
      '“袅娜”“羞涩”声音放柔，拟人感要出来。',
      '三个“如”层层递进，一浪高过一浪。',
    ],
  ),
  buildLesson(
    'l3',
    '再别康桥（节选）',
    '徐志摩',
    '高中必修',
    '现代诗歌',
    '轻轻的我走了，正如我轻轻的来；我轻轻的招手，作别西天的云彩。那河畔的金柳，是夕阳中的新娘；波光里的艳影，在我的心头荡漾。',
    [
      '三个“轻轻的”一叹三叠，声音要轻。',
      '“招手”“作别”连贯，读出依依不舍。',
      '“新娘”一词惊喜而克制，不要喊。',
      '“荡漾”尾音放慢放长，余韵收住。',
    ],
  ),
];

export const STUDENTS: Student[] = [
  { id: 'stu1', name: '林晓舟', initials: '晓', color: '#2f9e8f' },
  { id: 'stu2', name: '苏晚晴', initials: '晚', color: '#c2703d' },
  { id: 'stu3', name: '陈默', initials: '默', color: '#5b7fb8' },
  { id: 'stu4', name: '何雨桐', initials: '桐', color: '#a05fa0' },
  { id: 'stu5', name: '周子航', initials: '航', color: '#b8902f' },
  { id: 'stu6', name: '顾安然', initials: '然', color: '#4f9e6b' },
];

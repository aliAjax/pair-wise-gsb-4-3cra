// 课文资料层：只描述课文、有序片段与班级学生，不包含任何接力规则。
export interface Segment {
  id: string;
  order: number;
  text: string;
  hint: string;
}

export interface Lesson {
  id: string;
  title: string;
  source: string;
  segments: Segment[];
}

export interface Student {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export const lesson: Lesson = {
  id: 'lesson-spring',
  title: '春（节选）',
  source: '朱自清 · 散文朗读接力',
  segments: [
    { id: 'seg-1', order: 1, text: '盼望着，盼望着，东风来了，春天的脚步近了。', hint: '轻快上扬 · 盼春' },
    { id: 'seg-2', order: 2, text: '一切都像刚睡醒的样子，欣欣然张开了眼。', hint: '舒展放缓 · 苏醒' },
    { id: 'seg-3', order: 3, text: '山朗润起来了，水涨起来了，太阳的脸红起来了。', hint: '排比递进 · 回暖' },
    { id: 'seg-4', order: 4, text: '小草偷偷地从土里钻出来，嫩嫩的，绿绿的。', hint: '俏皮轻读 · 春草' },
    { id: 'seg-5', order: 5, text: '园子里，田野里，瞧去，一大片一大片满是的。', hint: '由近及远 · 满眼' },
    { id: 'seg-6', order: 6, text: '坐着，躺着，打两个滚，踢几脚球，赛几趟跑，捉几回迷藏。', hint: '节奏跳跃 · 嬉戏' },
  ],
};

export const students: Student[] = [
  { id: 'stu-1', name: '林晓雨', initials: '林', color: '#18a688' },
  { id: 'stu-2', name: '陈浩然', initials: '陈', color: '#4f7cf7' },
  { id: 'stu-3', name: '苏晚晴', initials: '苏', color: '#c96fb0' },
  { id: 'stu-4', name: '赵启铭', initials: '赵', color: '#d98a2b' },
  { id: 'stu-5', name: '何静怡', initials: '何', color: '#7a6ff0' },
];

export const studentName = (id: string): string =>
  students.find(s => s.id === id)?.name ?? id;

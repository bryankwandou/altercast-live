import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const SOURCE_DIR = 'E:\\0download blender';
const OUTPUT_FILE = path.resolve('src/data/models.json');

function formatTitle(rawName) {
  let clean = rawName
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/\s*\(\d+\)$/, '') // remove (1), (2)
    .replace(/[_\-]+/g, ' ') // replace _ and - with space
    .trim();

  // Clean specific quirks
  clean = clean.replace(/\bnsfw\b/gi, '').trim();
  clean = clean.replace(/\s+/g, ' ');

  // Title case
  return clean
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function detectCategory(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes('base_mesh') || lower.includes('base-body') || lower.includes('torso') || lower.includes('anatomy') || lower.includes('base mesh')) {
    return { key: 'base_mesh', id: 'Base Mesh & Anatomi', en: 'Base Mesh & Anatomy' };
  }
  if (lower.includes('factory') || lower.includes('scene') || lower.includes('abandoned') || lower.includes('room') || lower.includes('building')) {
    return { key: 'environment', id: 'Lingkungan & Scene', en: 'Environment & Scene' };
  }
  if (lower.includes('condom') || lower.includes('toy') || lower.includes('dress') || lower.includes('lingerie') || lower.includes('heels') || lower.includes('prop')) {
    return { key: 'props_costumes', id: 'Aset & Busana', en: 'Props & Costumes' };
  }
  if (
    lower.includes('ada_wong') || lower.includes('genshin') || lower.includes('zzz') || lower.includes('anby') ||
    lower.includes('nicole') || lower.includes('ellen_joe') || lower.includes('burnice') || lower.includes('beidou') ||
    lower.includes('keqing') || lower.includes('ningguang') || lower.includes('columbina') || lower.includes('chun_li') ||
    lower.includes('arena_of_valor') || lower.includes('aov') || lower.includes('fortnite') || lower.includes('granado') ||
    lower.includes('diao_chan') || lower.includes('rouie') || lower.includes('sinestrea') || lower.includes('airi') ||
    lower.includes('aoi') || lower.includes('mina') || lower.includes('fnaf')
  ) {
    return { key: 'game_characters', id: 'Karakter Game', en: 'Game Characters' };
  }
  if (lower.includes('anime') || lower.includes('manga') || lower.includes('ayanami') || lower.includes('vtuber') || lower.includes('bikini')) {
    return { key: 'anime_manga', id: 'Anime & Manga', en: 'Anime & Manga' };
  }
  return { key: 'stylized_fantasy', id: 'Fantasi & Lainnya', en: 'Fantasy & Stylized' };
}

function generateTags(filename, categoryKey) {
  const tags = new Set();
  const lower = filename.toLowerCase();

  if (lower.includes('rigged')) tags.add('Rigged');
  if (lower.includes('clean_topology')) tags.add('Clean Topology');
  if (lower.includes('gameready') || lower.includes('game-ready')) tags.add('Game Ready');
  if (lower.includes('textured')) tags.add('Textured');
  if (lower.includes('low_poly') || lower.includes('low poly')) tags.add('Low Poly');
  if (lower.includes('ada_wong')) tags.add('Resident Evil');
  if (lower.includes('genshin') || lower.includes('beidou') || lower.includes('keqing') || lower.includes('ningguang') || lower.includes('columbina')) tags.add('Genshin Impact');
  if (lower.includes('zzz') || lower.includes('anby') || lower.includes('nicole') || lower.includes('ellen_joe') || lower.includes('burnice')) tags.add('Zenless Zone Zero');
  if (lower.includes('arena_of_valor') || lower.includes('aov')) tags.add('Arena of Valor');
  if (lower.includes('fortnite')) tags.add('Fortnite');
  if (lower.includes('granado')) tags.add('Granado Espada');
  if (lower.includes('chun_li')) tags.add('Street Fighter');
  if (lower.includes('ayanami')) tags.add('Evangelion');
  if (lower.includes('dance')) tags.add('Animation / Mocap');

  // Format extension
  const ext = path.extname(filename).toUpperCase().replace('.', '');
  tags.add(ext);

  return Array.from(tags);
}

// Known zip contents from analysis
const ZIP_CONTENTS = {
  'base-body-female-v2.zip': ['.blend', '.jpeg'],
  'hentai-girl-ahoga-naked.zip': ['.blend', '.png'],
  'horse-pussy-and-vagina-plus-anus.zip': ['.blend'],
  'anime-girl-in-bikini.zip': ['.fbx', '.png'],
  'delke-js2.zip': ['.fbx', '.png'],
  'elf-girl-2-textured.zip': ['.fbx', '.png', '.jpeg'],
  'girl-model.zip': ['.fbx'],
  'hu-tao-swimsuit.zip': ['.fbx', '.png'],
  'sexy-anime-girl-3d-model-free-to-use.zip': ['.fbx', '.png'],
  'sexy-girl.zip': ['.fbx', '.png'],
  'emerald-serenity.zip': ['.glb', '.jpeg'],
  'helen-parr.zip': ['.glb', '.jpeg'],
  'lauma-naked.zip': ['.glb', '.png'],
  'rabbit_demo_free_download.zip': ['.gltf', '.bin', '.png']
};

function run() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Directory ${SOURCE_DIR} does not exist.`);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR);
  const models = [];
  let index = 1;

  for (const filename of files) {
    if (filename === 'github-recovery-codes.txt' || filename.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(SOURCE_DIR, filename);
    const stat = fs.statSync(fullPath);

    if (!stat.isFile()) continue;

    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.glb' && ext !== '.zip' && ext !== '.gltf') {
      continue;
    }

    const category = detectCategory(filename);
    const tags = generateTags(filename, category.key);
    const isDuplicate = /\(\d+\)/.test(filename);
    const cleanBaseName = path.basename(filename, ext).replace(/\s*\(\d+\)$/, '');

    // Check inner formats for zip archives
    const innerFormats = ZIP_CONTENTS[filename.toLowerCase()] || [];
    if (innerFormats.length > 0) {
      innerFormats.forEach(f => tags.push(f.replace('.', '').toUpperCase()));
    }

    models.push({
      id: `model_${String(index).padStart(3, '0')}`,
      filename,
      title: formatTitle(filename),
      categoryKey: category.key,
      categoryNameId: category.id,
      categoryNameEn: category.en,
      format: ext.replace('.', '').toUpperCase(),
      innerFormats,
      sizeBytes: stat.size,
      sizeFormatted: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
      isDuplicate,
      cleanBaseName,
      tags: Array.from(new Set(tags)),
      lastModified: stat.mtime.toISOString().split('T')[0]
    });

    index++;
  }

  models.sort((a, b) => a.title.localeCompare(b.title));

  const metadata = {
    generatedAt: new Date().toISOString(),
    totalFiles: models.length,
    uniqueModels: new Set(models.map(m => m.cleanBaseName)).size,
    totalSizeBytes: models.reduce((acc, m) => acc + m.sizeBytes, 0),
    totalSizeFormatted: (models.reduce((acc, m) => acc + m.sizeBytes, 0) / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
    categories: [
      { key: 'all', labelId: 'Semua Model', labelEn: 'All Models' },
      { key: 'game_characters', labelId: 'Karakter Game', labelEn: 'Game Characters' },
      { key: 'anime_manga', labelId: 'Anime & Manga', labelEn: 'Anime & Manga' },
      { key: 'base_mesh', labelId: 'Base Mesh & Anatomi', labelEn: 'Base Mesh & Anatomy' },
      { key: 'props_costumes', labelId: 'Aset & Busana', labelEn: 'Props & Costumes' },
      { key: 'environment', labelId: 'Lingkungan & Scene', labelEn: 'Environment & Scene' },
      { key: 'stylized_fantasy', labelId: 'Fantasi & Lainnya', labelEn: 'Fantasy & Stylized' }
    ],
    models
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`Generated catalog: ${models.length} items saved to ${OUTPUT_FILE}`);
  console.log(`Total Size: ${metadata.totalSizeFormatted}`);
  console.log(`Unique Models: ${metadata.uniqueModels}`);
}

run();

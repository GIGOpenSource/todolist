<script setup>
/**
 * @file pages-sub/create — 创建伴侣向导
 * @description 多步表单（人设/城市/MBTI/性格标签等），提交 POST /companions。
 * @depends loadPresets、api、personalityTags、companionLang
 */
import { ref, computed, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useI18n } from "vue-i18n";
import AppPageShell from "@/components/AppPageShell.vue";
import { requireAuth } from "@/composables/useAuth";
import { api, apiFetch } from "@/utils/api";
import { loadPresetPersonas } from "@/data/createCompanion/loadPresets";
import { inferCompanionLanguage } from "@/utils/companionLang";
import {
  getPersonalityKey,
  personalityFeaturedKeys,
  personalityGroupOrder,
  personalityMeta,
  personalityMutexPairs,
  personalityTagTranslations,
  translatePersonalityTag,
} from "@/utils/personalityTags";
import {
  formatCompanionAge,
  formatCompanionName,
  uiLangCode,
} from "@/utils/formatCompanion";
import { showToast } from "@/stores/toast";
import { getItem, removeItem } from "@/utils/storage";
import { invalidateCompanionsCache } from "@/utils/companionsCache";
import { bindAnalyticsTap } from "@/utils/analytics";

requireAuth();

const { t, locale } = useI18n();
const currentLang = computed(() => uiLangCode(locale.value));

// ——— 表单状态 ———

// ——— 性格标签目录（分组 + 推荐 + 互斥，与后端 personality_catalog 对齐） ———
const personalityCatalog = ref([]); // { key, label, bucket, group }[]
const personalityMutex = ref(personalityMutexPairs.map((p) => [...p]));
const featuredKeys = ref([...personalityFeaturedKeys]);
const showAllPersonalities = ref(false);
const personalityMutexHint = ref("");

const GROUP_LABEL_KEYS = {
  temperament: "temperament",
  social: "social",
  emotion: "emotion",
  style: "style",
};

/** 16 型 MBTI 人格 */
const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
];

/** 性取向选项（i18n key 在 register 下） */
const ORIENTATIONS = [
  "heterosexual",
  "homosexual",
  "bisexual",
  "pansexual",
  "asexual",
  "secret",
];

// 基础必填项
const name = ref("");
const age = ref(22);
const gender = ref("female");
const city = ref("");
const selectedPersonalities = ref([]);
const background = ref("");
const speakingStyle = ref("");
// 选填人设细节
const hobbies = ref("");
const values = ref("");
const fears = ref("");
const loveView = ref("");
const dailyRoutine = ref("");
const favoriteThings = ref("");
const mbti = ref("INTJ");
const sexualOrientation = ref("heterosexual");
const lifeStory = ref("");
const culturalValues = ref("");
const genderPerspective = ref("");
// 聊天记录导入
const chatHistoryRaw = ref("");
const chatHistoryCount = ref(0);
// 页面状态：字段错误 / 提交中 / 一键填充中 / MBTI 弹窗 / 性取向弹窗
const errors = ref({});
const creating = ref(false);
const autoFilling = ref(false);
const showMbtiPicker = ref(false);
const tempMbti = ref("INTJ"); // 弹窗内临时选中值，点确定才写入 mbti
const showOrientationPicker = ref(false);
const tempOrientation = ref("heterosexual"); // 弹窗内临时性取向

/** 打开 MBTI 弹窗，用当前值初始化临时选中 */
function openMbtiPicker() {
  tempMbti.value = mbti.value || MBTI_TYPES[0];
  showMbtiPicker.value = true;
}

/** MBTI 选项列表：类型码 + 多语言描述 */
const mbtiOptions = computed(() =>
  MBTI_TYPES.map((type) => ({
    value: type,
    label: `${type} - ${t(`createCompanion.mbtiTypes.${type}`)}`,
  }))
);

const mbtiPickerIndex = computed(() => {
  const idx = MBTI_TYPES.indexOf(mbti.value);
  return idx >= 0 ? idx : 0;
});

const mbtiDisplayLabel = computed(() => {
  const opt = mbtiOptions.value.find((o) => o.value === mbti.value);
  return opt?.label || MBTI_TYPES[0];
});

function personalityLabel(tagOrKey) {
  return translatePersonalityTag(tagOrKey, currentLang.value);
}

/** 任意语言标签文案 → 标准 catalog key（未识别时返回原文） */
function toPersonalityKey(tagOrKey) {
  return getPersonalityKey(tagOrKey) || String(tagOrKey || "").trim();
}

/** 用本地字典构建性格目录（后端目录接口失败时的兜底） */
function buildLocalPersonalityCatalog(lang) {
  const map = personalityTagTranslations[lang] || personalityTagTranslations.zh || {};
  const keys = Object.keys(personalityMeta || {}).length
    ? Object.keys(personalityMeta)
    : Object.keys(map);
  return keys
    .filter((key) => map[key])
    .map((key) => ({
      key,
      label: map[key],
      bucket: personalityMeta[key]?.bucket || "neutral",
      group: personalityMeta[key]?.group || "style",
    }));
}

/** 折叠态只展示推荐标签；已选但不在推荐里的也保留，避免选中后消失 */
const visiblePersonalityItems = computed(() => {
  const items = personalityCatalog.value;
  if (showAllPersonalities.value || !featuredKeys.value.length) return items;
  const featured = new Set(featuredKeys.value);
  const featuredItems = featuredKeys.value
    .map((k) => items.find((i) => i.key === k))
    .filter(Boolean);
  const extraSelected = items.filter(
    (i) => selectedPersonalities.value.includes(i.key) && !featured.has(i.key)
  );
  const seen = new Set(featuredItems.map((i) => i.key));
  for (const e of extraSelected) {
    if (!seen.has(e.key)) {
      featuredItems.push(e);
      seen.add(e.key);
    }
  }
  return featuredItems.length ? featuredItems : items.slice(0, 24);
});

/** 按 气质/社交/情绪/风格 分组的展示视图 */
const personalityGroupsView = computed(() => {
  const items = visiblePersonalityItems.value;
  return personalityGroupOrder
    .map((gid) => ({
      id: gid,
      label: t(`createCompanion.personalityGroups.${GROUP_LABEL_KEYS[gid] || gid}`),
      items: items.filter((i) => i.group === gid),
    }))
    .filter((g) => g.items.length > 0);
});

/** 检查已选组合是否命中互斥对，命中返回提示文案 */
function checkPersonalityMutex(keys) {
  const set = new Set(keys);
  for (const [a, b] of personalityMutex.value) {
    if (set.has(a) && set.has(b)) {
      return t("createCompanion.personalityMutex", {
        a: personalityLabel(a),
        b: personalityLabel(b),
      });
    }
  }
  return "";
}

/** 拉取后端性格目录（目录/推荐/互斥），失败时回退本地字典 */
async function loadPersonalitiesForLang(lang) {
  personalityCatalog.value = buildLocalPersonalityCatalog(lang);
  // 后端目录接口暂未上线，先只用本地字典；接口就绪后取消注释即可
  // try {
  //   const data = await apiFetch(`/api/culture/personalities?lang=${lang}`);
  //   if (data?.items?.length) {
  //     personalityCatalog.value = data.items.map((it) => ({
  //       key: it.key,
  //       label: it.label || personalityLabel(it.key),
  //       bucket: it.bucket || "neutral",
  //       group: it.group || "style",
  //     }));
  //   }
  //   if (data?.featured_keys?.length) featuredKeys.value = data.featured_keys;
  //   if (data?.mutex_pairs?.length) {
  //     personalityMutex.value = data.mutex_pairs.map((p) => [...p]);
  //   }
  // } catch {
  //   /* 本地 personalityTagTranslations 兜底 */
  // }
}

watch(currentLang, (lang) => void loadPersonalitiesForLang(lang), { immediate: true });

// ——— 预设加载 ———

/**
 * 从 clone_companion_data 解析并填充表单（仅复制页面可编辑的字段）。
 * 通常由「我的智能体」页点击复制后跳转而来。
 */
function prefillFromClone(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.name) name.value = data.name.length > 20 ? data.name.slice(0, 20) : data.name;
    if (data.age) age.value = data.age;
    if (data.gender) gender.value = data.gender;
    if (data.city) city.value = data.city;
    if (data.personality) {
      const parts = String(data.personality)
        .split(/[、,，]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => toPersonalityKey(p));
      selectedPersonalities.value = parts;
      personalityMutexHint.value = checkPersonalityMutex(parts);
    }
    if (data.background) background.value = data.background;
    if (data.speech_style) speakingStyle.value = data.speech_style;
    if (data.hobbies) hobbies.value = data.hobbies;
    if (data.values) values.value = data.values;
    if (data.fears) fears.value = data.fears;
    if (data.love_view) loveView.value = data.love_view;
    if (data.daily_routine) dailyRoutine.value = data.daily_routine;
    if (data.favorite_things) favoriteThings.value = data.favorite_things;
    if (data.mbti) mbti.value = data.mbti;
    if (data.sexual_orientation) sexualOrientation.value = data.sexual_orientation;
    if (data.life_story) lifeStory.value = data.life_story;
    if (data.cultural_values) culturalValues.value = data.cultural_values;
    if (data.gender_perspective) genderPerspective.value = data.gender_perspective;
  } catch {
    /* ignore parse errors */
  }
}

/** 页面入口：如果 query.clone=1 则从本地缓存读取被复制的伴侣数据并预填充 */
onLoad((query) => {
  if (query?.clone !== "1") return;
  const raw = getItem("clone_companion_data");
  if (!raw) return;
  prefillFromClone(raw);
  removeItem("clone_companion_data");
});

/** 点击性格标签：已选取消；未选加入（最多 4 个），并检测互斥组合 */
function togglePersonality(key) {
  const k = toPersonalityKey(key);
  if (!k) return;
  if (selectedPersonalities.value.includes(k)) {
    selectedPersonalities.value = selectedPersonalities.value.filter((p) => p !== k);
  } else {
    if (selectedPersonalities.value.length >= 4) {
      showToast(t("createCompanion.errors.personalityMax"));
      return;
    }
    selectedPersonalities.value = [...selectedPersonalities.value, k];
  }
  personalityMutexHint.value = checkPersonalityMutex(selectedPersonalities.value);
}

/**
 * 一键填充：先拉语言对应预设人设，再调用 /companions/generate 生成详细文案。
 * 自动填充期间会关闭 watch 校验，避免中间态报错。
 */
async function handleAutoFill() {
  autoFilling.value = true;
  try {
    const lang = currentLang.value;
    const list = await loadPresetPersonas(lang);
    const persona = list[Math.floor(Math.random() * list.length)];
    const apiGender = persona.gender === "男" ? "male" : "female";

    // Step 1: 调用接口获取随机名字
    let pickedName = persona.name;
    try {
      const data = await apiFetch(
        `/api/culture/names?lang=${lang}&gender=${apiGender}&count=8`
      );
      if (data.names?.length) {
        pickedName = data.names[Math.floor(Math.random() * data.names.length)];
      }
    } catch {
      /* fallback to preset name */
    }
    const finalName = formatCompanionName(pickedName, persona.name);
    const finalAge = persona.age;
    const finalGender = apiGender;
    const finalOrientation = persona.sexual_orientation || "heterosexual";
    const finalCity = persona.city;
    const finalPersonalities = String(persona.personality || "")
      .split(/[、,，]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const finalMbti = persona.mbti || MBTI_TYPES[0];

    // Step 2: 调用 /companions/generate 生成详细内容
    const generatePayload = {
      name: finalName,
      age: finalAge,
      gender: persona.gender,
      city: finalCity,
      personality: finalPersonalities.join("、"),
      background: persona.background || "",
      speech_style: persona.speech_style || "",
    };

    let generated = null;
    try {
      generated = await apiFetch("/companions/generate", {
        method: "POST",
        data: generatePayload,
        timeout: 60000,
      });
    } catch (e) {
      console.warn("[AutoFill] generate 接口失败，回退本地预设:", e);
    }

    // Step 3: 两个接口都完成后，一次性填充所有字段
    name.value = finalName.length > 20 ? finalName.slice(0, 20) : finalName;
    age.value = finalAge;
    gender.value = finalGender;
    sexualOrientation.value = finalOrientation;
    city.value = finalCity;
    selectedPersonalities.value = finalPersonalities
      .map((p) => toPersonalityKey(p))
      .slice(0, 4);
    personalityMutexHint.value = checkPersonalityMutex(selectedPersonalities.value);
    mbti.value = finalMbti;
    errors.value = {};

    const g = generated || {};
    background.value = g.background || persona.background || "";
    speakingStyle.value = g.speech_style || persona.speech_style || "";
    hobbies.value = g.hobbies || persona.hobbies || "";
    values.value = g.values || persona.values || "";
    fears.value = g.fears || persona.fears || "";
    loveView.value = g.love_view || persona.love_view || "";
    dailyRoutine.value = g.daily_routine || persona.daily_routine || "";
    favoriteThings.value = g.favorite_things || persona.favorite_things || "";
    lifeStory.value = g.life_story || persona.life_story || "";
    culturalValues.value = g.cultural_values || persona.cultural_values || "";
    genderPerspective.value = g.gender_perspective || persona.gender_perspective || "";
  } catch (err) {
    console.error("[AutoFill] 生成失败:", err);
    showToast(t("common.networkError") || "网络错误，请重试");
  } finally {
    autoFilling.value = false;
  }
}

/**
 * 将聊天记录文本解析为 {role, content} 数组。
 * 支持 JSON 数组格式，也支持 "用户:xxx / AI:xxx" 的文本格式。
 */
function parseChatHistory(raw) {
  if (!raw.trim()) return [];
  if (raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (Array.isArray(parsed)) {
        return parsed
          .filter((m) => m.role && m.content)
          .map((m) => ({ role: m.role, content: String(m.content) }));
      }
    } catch {
      /* continue text parsing */
    }
  }
  const lines = raw.split("\n").filter((l) => l.trim());
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(用户|我|user)[\s:：]/i.test(trimmed)) {
      result.push({
        role: "user",
        content: trimmed.replace(/^(用户|我|user)[\s:：]/i, "").trim(),
      });
    } else if (/^(AI|智能体|assistant|对方|ta|TA)[\s:：]/i.test(trimmed)) {
      result.push({
        role: "assistant",
        content: trimmed.replace(/^(AI|智能体|assistant|对方|ta|TA)[\s:：]/i, "").trim(),
      });
    } else if (result.length > 0) {
      result[result.length - 1].content += "\n" + trimmed;
    }
  }
  return result;
}

/** 聊天记录输入：同步原始文本并更新已识别消息数 */
function onChatHistoryInput(e) {
  chatHistoryRaw.value = e.detail.value;
  chatHistoryCount.value = parseChatHistory(e.detail.value).length;
}

// ——— 校验提交 ———

/** 校验必填项与字数，失败时 toast 提示 */
function validateForm() {
  const newErrors = {};
  const personalityStr = selectedPersonalities.value.join("、");

  if (!name.value.trim()) newErrors.name = t("createCompanion.errors.nameRequired");
  if (name.value.length > 20) newErrors.name = t("createCompanion.errors.nameMax");
  if (!age.value && age.value !== 0) newErrors.age = t("createCompanion.errors.ageRequired");
  if (!gender.value) newErrors.gender = t("createCompanion.errors.genderRequired");
  if (!city.value.trim()) newErrors.city = t("createCompanion.errors.cityRequired");
  if (!personalityStr.trim()) newErrors.personality = t("createCompanion.errors.personalityRequired");
  if (selectedPersonalities.value.length < 2) {
    newErrors.personality = t("createCompanion.errors.personalityMin");
  } else if (selectedPersonalities.value.length > 4) {
    newErrors.personality = t("createCompanion.errors.personalityMax");
  } else {
    const mutex = checkPersonalityMutex(selectedPersonalities.value);
    if (mutex) {
      personalityMutexHint.value = mutex;
      newErrors.personality = mutex;
    }
  }
  if (!mbti.value.trim()) newErrors.mbti = t("createCompanion.errors.mbtiRequired");
  if (!sexualOrientation.value.trim()) {
    newErrors.sexualOrientation = t("createCompanion.errors.orientationRequired");
  }
  if (!background.value.trim()) {
    newErrors.background = t("createCompanion.errors.backgroundRequired");
  } else if (background.value.trim().length < 5) {
    newErrors.background = t("createCompanion.errors.backgroundMin");
  }
  if (!speakingStyle.value.trim()) {
    newErrors.speakingStyle = t("createCompanion.errors.speechRequired");
  } else if (speakingStyle.value.trim().length < 5) {
    newErrors.speakingStyle = t("createCompanion.errors.speechMin");
  }

  errors.value = newErrors;
  const errorList = Object.values(newErrors);
  if (errorList.length > 0) {
    showToast(errorList.join("\n"));
  }
  return errorList.length === 0;
}

/** 单项实时校验：仅更新对应字段的 error，不弹 toast */
function validateField(field) {
  const newErrors = { ...errors.value };
  const personalityStr = selectedPersonalities.value.join("、");

  switch (field) {
    case "name":
      if (!name.value.trim()) newErrors.name = t("createCompanion.errors.nameRequired");
      else if (name.value.length > 20) newErrors.name = t("createCompanion.errors.nameMax");
      else delete newErrors.name;
      break;
    case "age":
      if (!age.value && age.value !== 0) newErrors.age = t("createCompanion.errors.ageRequired");
      else delete newErrors.age;
      break;
    case "gender":
      if (!gender.value) newErrors.gender = t("createCompanion.errors.genderRequired");
      else delete newErrors.gender;
      break;
    case "city":
      if (!city.value.trim()) newErrors.city = t("createCompanion.errors.cityRequired");
      else delete newErrors.city;
      break;
    case "personality":
      if (!personalityStr.trim()) newErrors.personality = t("createCompanion.errors.personalityRequired");
      else if (selectedPersonalities.value.length < 2) newErrors.personality = t("createCompanion.errors.personalityMin");
      else if (selectedPersonalities.value.length > 4) newErrors.personality = t("createCompanion.errors.personalityMax");
      else if (checkPersonalityMutex(selectedPersonalities.value)) newErrors.personality = checkPersonalityMutex(selectedPersonalities.value);
      else delete newErrors.personality;
      break;
    case "mbti":
      if (!mbti.value.trim()) newErrors.mbti = t("createCompanion.errors.mbtiRequired");
      else delete newErrors.mbti;
      break;
    case "sexualOrientation":
      if (!sexualOrientation.value.trim()) newErrors.sexualOrientation = t("createCompanion.errors.orientationRequired");
      else delete newErrors.sexualOrientation;
      break;
    case "background":
      if (!background.value.trim()) newErrors.background = t("createCompanion.errors.backgroundRequired");
      else if (background.value.trim().length < 5) newErrors.background = t("createCompanion.errors.backgroundMin");
      else delete newErrors.background;
      break;
    case "speakingStyle":
      if (!speakingStyle.value.trim()) newErrors.speakingStyle = t("createCompanion.errors.speechRequired");
      else if (speakingStyle.value.trim().length < 5) newErrors.speakingStyle = t("createCompanion.errors.speechMin");
      else delete newErrors.speakingStyle;
      break;
  }

  errors.value = newErrors;
}

/** 所有必填项是否通过校验（静默，不弹 toast） */
const isFormValid = computed(() => {
  if (!name.value.trim() || name.value.length > 20) return false;
  if (!age.value && age.value !== 0) return false;
  if (!gender.value) return false;
  if (!city.value.trim()) return false;
  if (selectedPersonalities.value.length < 2) return false;
  if (!mbti.value.trim()) return false;
  if (!sexualOrientation.value.trim()) return false;
  if (!background.value.trim() || background.value.trim().length < 5) return false;
  if (!speakingStyle.value.trim() || speakingStyle.value.trim().length < 5) return false;
  return true;
});

/** 实时校验：字段变化时立即校验对应项（自动填充期间跳过） */
const fieldWatchers = [
  [name, "name"],
  [age, "age"],
  [gender, "gender"],
  [city, "city"],
  [selectedPersonalities, "personality"],
  [mbti, "mbti"],
  [sexualOrientation, "sexualOrientation"],
  [background, "background"],
  [speakingStyle, "speakingStyle"],
];
fieldWatchers.forEach(([source, field]) => {
  watch(source, () => {
    if (!autoFilling.value) validateField(field);
  });
});

/** 提交创建伴侣请求并跳转消息页 */
async function handleCreate() {
  if (creating.value) return;
  if (!validateForm()) return;

  const companionLang = inferCompanionLanguage(city.value);
  const payload = {
    name: name.value.trim(),
    age: age.value,
    gender: gender.value === "male" ? "男" : "女",
    city: city.value.trim(),
    personality: selectedPersonalities.value
      .map((p) => translatePersonalityTag(p, companionLang || currentLang.value))
      .join("、"),
    mbti: mbti.value,
    sexual_orientation: sexualOrientation.value,
    avatar_url: "__GENERATING__",
    background: background.value.trim(),
    speech_style: speakingStyle.value.trim(),
    hobbies: hobbies.value || "",
    values: values.value || "",
    fears: fears.value || "",
    love_view: loveView.value || "",
    daily_routine: dailyRoutine.value || "",
    favorite_things: favoriteThings.value || "",
    life_story: lifeStory.value || "",
    cultural_values: culturalValues.value || "",
    gender_perspective: genderPerspective.value || "",
    language: companionLang,
  };

  const parsedHistory = parseChatHistory(chatHistoryRaw.value);
  if (parsedHistory.length > 0) {
    payload.chat_history = parsedHistory;
  }

  creating.value = true;
  try {
    await api.post("/companions", payload);
    invalidateCompanionsCache();
    uni.reLaunch({ url: "/pages/messages/index" });
  } catch (err) {
    console.error("[CreateCompanion] 创建智能体失败:", err);
  } finally {
    creating.value = false;
  }
}

/** 确定选择：把弹窗内临时 MBTI 写入表单 */
function onMbtiSelect() {
  mbti.value = tempMbti.value;
  showMbtiPicker.value = false;
}

/** 打开性取向弹窗，用当前值初始化临时选中 */
function openOrientationPicker() {
  tempOrientation.value = sexualOrientation.value || ORIENTATIONS[0];
  showOrientationPicker.value = true;
}

/** 确定选择：把弹窗内临时性取向写入表单 */
function onOrientationSelect() {
  sexualOrientation.value = tempOrientation.value;
  showOrientationPicker.value = false;
}

/** 年龄 slider 变化 */
function onAgeChange(e) {
  age.value = Number(e.detail.value);
}
</script>

<template>
  <AppPageShell
    :title="t('createCompanion.title')"
    :show-back="true"
    header-right
    back-analytics-id="create-companion-back"
    back-analytics-name="创建伴侣页返回"
  >
    <template #header-right>
      <view class="autofill-btn" :class="{ disabled: autoFilling }" @tap="bindAnalyticsTap('create-companion-autofill', handleAutoFill, '自动填充')">
        <text>{{ t("createCompanion.autoFill") }}</text>
      </view>
    </template>

    <!-- 一键填充加载遮罩 -->
    <view v-if="autoFilling" class="autofill-mask">
      <view class="autofill-loader">
        <view class="loader-spinner"></view>
        <text class="loader-text">{{ t("createCompanion.aiGenerate") }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="form-scroll">
      <view class="form-inner">
        <!-- 名字 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.name") }}
            <text class="required">*</text>
            <text class="char-count" :class="{ over: name.length > 20 }">{{ name.length }}/20</text>
          </text>
          <input
            :value="name"
            class="input-field"
            :class="{ 'input-error': errors.name }"
            :placeholder="t('createCompanion.namePlaceholder')"
            :maxlength="20"
              @input="name = $event.detail.value"
          />
          <text v-if="errors.name" class="error-text">{{ errors.name }}</text>
        </view>

        <!-- 年龄滑块 -->
        <view class="field">
          <view class="label">
            <text>{{ t("createCompanion.ageLabel") }}</text>
            <text>{{ age }}</text>
            <text class="required">*</text>
          </view>
          <slider
            :min="18"
            :max="99"
            :value="age"
            active-color="#FFF946"
            background-color="var(--border)"
            block-color="#E747A4"
            block-size="14"
            @change="onAgeChange"
          />
          <view class="range-hints">
            <text class="text-muted">18</text>
            <text class="text-muted">99</text>
          </view>
          <text v-if="errors.age" class="error-text">{{ errors.age }}</text>
        </view>

        <!-- 性别 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.gender") }}
            <text class="required">*</text>
          </text>
          <view class="flex-row gap-sm">
            <button
              class="gender-btn"
              :class="{ active: gender === 'male' }"
              @tap="gender = 'male'"
            >
              {{ t("register.male") }}
            </button>
            <button
              class="gender-btn"
              :class="{ active: gender === 'female' }"
              @tap="gender = 'female'"
            >
              {{ t("register.female") }}
            </button>
          </view>
          <text v-if="errors.gender" class="error-text">{{ errors.gender }}</text>
        </view>

        <!-- 性取向 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.sexualOrientation") }}
            <text class="required">*</text>
          </text>
          <view class="input-field picker-field" :class="{ 'input-error': errors.sexualOrientation }" @tap="openOrientationPicker">
            {{ t(`register.${sexualOrientation}`) }}
            <text class="picker-arrow">›</text>
          </view>
          <text v-if="errors.sexualOrientation" class="error-text">{{ errors.sexualOrientation }}</text>
        </view>

        <!-- 性取向自定义弹窗 -->
        <up-popup :show="showOrientationPicker" mode="bottom" :safe-area-inset-bottom="true" round="24" bg-color="transparent" @close="showOrientationPicker = false">
          <view class="orientation-picker-popup">
            <view class="orientation-picker-toolbar">
              <text class="orientation-picker-cancel" @tap="showOrientationPicker = false">{{ t("common.cancel") }}</text>
              <text class="orientation-picker-title">{{ t("createCompanion.sexualOrientation") }}</text>
              <text class="orientation-picker-confirm" @tap="onOrientationSelect">{{ t("common.confirm") }}</text>
            </view>
            <scroll-view scroll-y class="orientation-picker-list">
              <view
                v-for="o in ORIENTATIONS"
                :key="o"
                class="orientation-picker-item"
                :class="{ active: tempOrientation === o }"
                @tap="tempOrientation = o"
              >
                <text>{{ t(`register.${o}`) }}</text>
                <text v-if="tempOrientation === o" class="orientation-picker-check">✓</text>
              </view>
            </scroll-view>
          </view>
        </up-popup>

        <!-- 城市（改为文本输入） -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.city") }}
            <text class="required">*</text>
			<text class="char-count" :class="{ over: city.length > 20 }">{{ city.length }}/20</text>
          </text>
          <input
            :value="city"
            class="input-field"
            :class="{ 'input-error': errors.city }"
			:maxlength="20"
            :placeholder="t('createCompanion.cityPlaceholder')"
            @input="city = $event.detail.value"
          />
          <text v-if="errors.city" class="error-text">{{ errors.city }}</text>
        </view>

        <!-- MBTI（up-popup 自定义深色选择器） -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.mbti") }}
            <text class="required">*</text>
          </text>
          <view class="input-field picker-field" :class="{ 'input-error': errors.mbti }" @tap="openMbtiPicker">
            {{ mbtiDisplayLabel }}
            <text class="picker-arrow">›</text>
          </view>
          <text v-if="errors.mbti" class="error-text">{{ errors.mbti }}</text>
        </view>

        <up-popup :show="showMbtiPicker" mode="bottom" :safe-area-inset-bottom="true" round="24" bg-color="transparent" @close="showMbtiPicker = false">
          <view class="mbti-picker-popup">
            <view class="mbti-picker-toolbar">
              <text class="mbti-picker-cancel" @tap="showMbtiPicker = false">{{ t("common.cancel") }}</text>
              <text class="mbti-picker-title">{{ t("createCompanion.mbti") }}</text>
              <text class="mbti-picker-confirm" @tap="onMbtiSelect">{{ t("common.confirm") }}</text>
            </view>
            <scroll-view scroll-y class="mbti-picker-list">
              <view
                v-for="type in MBTI_TYPES"
                :key="type"
                class="mbti-picker-item"
                :class="{ active: tempMbti === type }"
                @tap="tempMbti = type"
              >
                <text>{{ type }} - {{ t(`createCompanion.mbtiTypes.${type}`) }}</text>
                <text v-if="tempMbti === type" class="mbti-picker-check">✓</text>
              </view>
            </scroll-view>
          </view>
        </up-popup>

        <!-- 性格标签 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.personalityLabel") }}
            <text class="required">*</text>
          </text>
          <text class="hint-text">{{ t("createCompanion.personalityHint") }}</text>
          <view
            v-for="group in personalityGroupsView"
            :key="group.id"
            class="personality-group"
          >
            <text class="personality-group-title">{{ group.label }}</text>
            <view class="tag-row">
              <button
                v-for="p in group.items"
                :key="p.key"
                class="tag-btn"
                :class="{ active: selectedPersonalities.includes(p.key) }"
                @tap="togglePersonality(p.key)"
              >
                {{ personalityLabel(p.key) }}
              </button>
            </view>
          </view>
          <view
            v-if="personalityCatalog.length > featuredKeys.length"
            class="personality-expand"
            @tap="showAllPersonalities = !showAllPersonalities"
          >
            <text class="hint-text">
              {{
                showAllPersonalities
                  ? t("createCompanion.personalityCollapse")
                  : t("createCompanion.personalityExpand")
              }}
            </text>
          </view>
          <text v-if="personalityMutexHint" class="hint-text mutex-hint">{{ personalityMutexHint }}</text>
          <text v-if="errors.personality" class="error-text">{{ errors.personality }}</text>
        </view>

        <!-- 背景故事 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.background") }}
            <text class="required">*</text>
            <text class="char-count" :class="{ over: background.length > 300 }">{{ background.length }}/300</text>
          </text>
          <textarea
            :value="background"
            class="input-field textarea"
            :class="{ 'input-error': errors.background }"
            :placeholder="t('createCompanion.backgroundPlaceholder')"
            :maxlength="300"
              @input="background = $event.detail.value"
          />
          <text v-if="errors.background" class="error-text">{{ errors.background }}</text>
        </view>

        <!-- 说话风格 -->
        <view class="field">
          <text class="label">
            {{ t("createCompanion.speechStyle") }}
            <text class="required">*</text>
            <text class="char-count" :class="{ over: speakingStyle.length > 300 }">{{ speakingStyle.length }}/300</text>
          </text>
          <textarea
            :value="speakingStyle"
            class="input-field textarea"
            :class="{ 'input-error': errors.speakingStyle }"
            :placeholder="t('createCompanion.speechStylePlaceholder')"
            :maxlength="300"
              @input="speakingStyle = $event.detail.value"
          />
          <text v-if="errors.speakingStyle" class="error-text">{{ errors.speakingStyle }}</text>
        </view>

        <!-- 聊天记录导入 -->
        <view class="section-divider">
          <text class="label">
            {{ t("createCompanion.importChatHistory") }}
            <text class="char-count" :class="{ over: chatHistoryRaw.length > 300 }">{{ chatHistoryRaw.length }}/300</text>
          </text>
          <textarea
            :value="chatHistoryRaw"
            class="input-field textarea chat-history"
            :placeholder="t('createCompanion.chatHistoryPlaceholder')"
            :maxlength="300"
              @input="onChatHistoryInput"
          />
          <text v-if="chatHistoryCount > 0" class="text-muted hint-text">
            {{ t("createCompanion.recognizedMessages", { count: chatHistoryCount }) }}
          </text>
        </view>

        <!-- 选填人设细节（当前仅启用 hobbies，其余注释保留） -->
        <view class="section-divider">
          <!-- <text class="section-hint">{{ t("createCompanion.personalityDetails") }}</text> -->

          <view class="field">
            <text class="label">
              {{ t("createCompanion.hobbies") }}
              <text class="char-count" :class="{ over: hobbies.length > 300 }">{{ hobbies.length }}/300</text>
            </text>
            <textarea
              :value="hobbies"
              class="input-field textarea short"
              :placeholder="t('createCompanion.hobbiesPlaceholder')"
              :maxlength="300"
              @input="hobbies = $event.detail.value"
            />
          </view>
<!-- 
          <view class="field">
            <text class="label">{{ t("createCompanion.values") }}</text>
            <textarea
              :value="values"
              class="input-field textarea short"
              :placeholder="t('createCompanion.valuesPlaceholder')"
              :maxlength="-1"
              @input="values = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.fears") }}</text>
            <textarea
              :value="fears"
              class="input-field textarea short"
              :placeholder="t('createCompanion.fearsPlaceholder')"
              :maxlength="-1"
              @input="fears = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.loveView") }}</text>
            <textarea
              :value="loveView"
              class="input-field textarea short"
              :placeholder="t('createCompanion.loveViewPlaceholder')"
              :maxlength="-1"
              @input="loveView = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.dailyRoutine") }}</text>
            <textarea
              :value="dailyRoutine"
              class="input-field textarea short"
              :placeholder="t('createCompanion.dailyRoutinePlaceholder')"
              :maxlength="-1"
              @input="dailyRoutine = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.favoriteThings") }}</text>
            <textarea
              :value="favoriteThings"
              class="input-field textarea short"
              :placeholder="t('createCompanion.favoriteThingsPlaceholder')"
              :maxlength="-1"
              @input="favoriteThings = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.lifeStory") }}</text>
            <textarea
              :value="lifeStory"
              class="input-field textarea tall"
              :placeholder="t('createCompanion.lifeStoryPlaceholder')"
              :maxlength="-1"
              @input="lifeStory = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.culturalValues") }}</text>
            <textarea
              :value="culturalValues"
              class="input-field textarea tall"
              :placeholder="t('createCompanion.culturalValuesPlaceholder')"
              :maxlength="-1"
              @input="culturalValues = $event.detail.value"
            />
          </view>

          <view class="field">
            <text class="label">{{ t("createCompanion.genderPerspective") }}</text>
            <textarea
              :value="genderPerspective"
              class="input-field textarea tall"
              :placeholder="t('createCompanion.genderPerspectivePlaceholder')"
              :maxlength="-1"
              @input="genderPerspective = $event.detail.value"
            />
          </view> -->
        </view>

        <!-- 实时预览卡片 -->
        <text class="preview-title">{{ t("createCompanion.preview") }}</text>
        <view class="preview-card-wrapper">
          <view class="preview-card-inner">
            <view class="preview-avatar">
              <text>{{ gender === "female" ? "👩" : "👨" }}</text>
            </view>
            <view class="preview-info">
              <text class="preview-name">{{ name || t("createCompanion.unnamed") }}</text>
              <text class="preview-meta">
                {{ formatCompanionAge(age, t) }} · {{ city || t("createCompanion.unknownCity") }}
              </text>
            </view>
          </view>
        </view>

        <!-- 提交按钮：校验全通过且未提交时才可点 -->
        <button class="btn-primary submit-btn" :disabled="!isFormValid || creating" @tap="bindAnalyticsTap('create-companion-submit', handleCreate, '创建伴侣')">
          {{ creating ? t("createCompanion.generating") : t("createCompanion.createBtn") }}
        </button>
      </view>
    </scroll-view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.form-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.form-inner {
  padding: 32rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.field {
  margin-bottom: 40rpx;
}

.label {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: var(--fg);
  margin-bottom: 16rpx;
  font-weight: 500;
}

.required {
  color: #ef4444;
  margin-left: 4rpx;
}

.char-count {
  font-size: 22rpx;
  color: var(--fg-muted);
  margin-left: auto;
  font-weight: 400;
}

.char-count.over {
  color: #ef4444;
}

/* 输入框统一为主题圆角 */
.input-field {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 32rpx;
  padding: 24rpx 28rpx;
  font-size: 28rpx;
  color: var(--fg);
  line-height: 1.4;
  box-sizing: border-box;
}

.input-field::placeholder {
  color: var(--fg-muted);
}

.input-error {
  border: 1px solid #ef4444 !important;
}

.error-text {
  display: block;
  color: #ef4444;
  font-size: 22rpx;
  margin-top: 8rpx;
}

.picker-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  line-height: 1.4;
  box-sizing: border-box;
  color: var(--fg);
}

.picker-arrow {
  font-size: 36rpx;
  color: var(--fg-muted);
  margin-left: auto;
}

/* MBTI 自定义弹窗 */
.mbti-picker-popup {
  background: var(--modal-bg, #1c1c1e);
  border-radius: 24rpx 24rpx 0 0;
}

.mbti-picker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1px solid var(--border);
}

.mbti-picker-cancel {
  color: var(--fg-muted);
  font-size: 28rpx;
}

.mbti-picker-title {
  color: var(--fg);
  font-size: 30rpx;
  font-weight: 600;
}

.mbti-picker-confirm {
  color: #FFF946;
  font-size: 28rpx;
  font-weight: 600;
}

.mbti-picker-list {
  max-height: 60vh;
}

.mbti-picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  color: var(--fg);
  font-size: 28rpx;
}

.mbti-picker-item.active {
  color: #FFF946;
}

.mbti-picker-check {
  color: #FFF946;
  font-size: 32rpx;
  font-weight: bold;
}

/* 性取向自定义弹窗（与 MBTI 弹窗同款深色风格） */
.orientation-picker-popup {
  background: var(--modal-bg, #1c1c1e);
  border-radius: 24rpx 24rpx 0 0;
}

.orientation-picker-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1px solid var(--border);
}

.orientation-picker-cancel {
  color: var(--fg-muted);
  font-size: 28rpx;
}

.orientation-picker-title {
  color: var(--fg);
  font-size: 30rpx;
  font-weight: 600;
}

.orientation-picker-confirm {
  color: #FFF946;
  font-size: 28rpx;
  font-weight: 600;
}

.orientation-picker-list {
  max-height: 60vh;
}

.orientation-picker-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  color: var(--fg);
  font-size: 28rpx;
}

.orientation-picker-item.active {
  color: #FFF946;
}

.orientation-picker-check {
  color: #FFF946;
  font-size: 32rpx;
  font-weight: bold;
}

.range-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 8rpx;
  font-size: 22rpx;
}

/* 年龄滑块：渐变滑条 + 粉色小圆点（handle 是拖拽热区须保持透明，圆点是 thumb） */
:deep(.uni-slider-track) {
  background-image: var(--gradient-brand) !important;
}
:deep(.uni-slider-handle) {
  background: transparent !important;
}
:deep(.uni-slider-thumb) {
  background: #E747A4 !important;
}
:deep(.wx-slider-track) {
  background-image: var(--gradient-brand) !important;
}
:deep(.wx-slider-handle) {
  background: transparent !important;
}
:deep(.wx-slider-thumb) {
  background: #E747A4 !important;
}

/* 性别按钮 */
.gender-btn {
  flex: 1;
  margin: 0;
  padding: 28rpx 16rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  line-height: 1.2;
  background: var(--card-bg);
  color: var(--fg-muted);
  border: none;

  &:not(:last-child) {
    margin-right: 16rpx;
  }
}

.gender-btn::after {
  border: none;
}

.gender-btn.active {
  background: var(--brand);
  color: #0A0A0A;
}

/* 标签 */
.tag-row {
  display: flex;
  flex-wrap: wrap;
}

.tag-btn {
  margin: 0 16rpx 16rpx 0;
  padding: 14rpx 28rpx;
  border-radius: 999px;
  font-size: 26rpx;
  line-height: 1.2;
  background: var(--bg-card);
  color: var(--fg-muted);
  border: 1px solid var(--border);
}

.tag-btn::after {
  border: none;
}

.tag-btn.active {
  background: var(--brand);
  color: #0A0A0A;
  border-color: transparent;
}

.personality-group {
  margin-top: 16rpx;
}

.personality-group-title {
  display: block;
  font-size: 22rpx;
  color: var(--fg-muted);
  margin-bottom: 12rpx;
}

.personality-expand {
  margin-top: 12rpx;
  padding: 8rpx 0;
}

.mutex-hint {
  color: #c2410c;
  margin-top: 12rpx;
}

.textarea {
  width: 100%;
  min-height: 160rpx;
  box-sizing: border-box;
}

.textarea.short {
  min-height: 120rpx;
}

.textarea.tall {
  min-height: 240rpx;
}

.textarea.chat-history {
  min-height: 320rpx;
  font-size: 26rpx;
}

.section-divider {
  // border-top: 1px solid var(--border);
  padding-top: 32rpx;
  margin-bottom: 32rpx;
}

.section-hint {
  display: block;
  font-size: 22rpx;
  color: var(--fg-muted);
  margin-bottom: 24rpx;
}

.hint-text {
  display: block;
  font-size: 22rpx;
  margin-top: 8rpx;
}

/* Preview */
.preview-title {
  display: block;
  font-size: 32rpx;
  color: var(--fg);
  margin-bottom: 24rpx;
  font-weight: 500;
}

.preview-card-wrapper {
  margin-bottom: 32rpx;
  background: linear-gradient(135deg, var(--brand-end), var(--brand));
  border-radius: 32rpx;
  padding: 2rpx;
}

.preview-card-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--preview-gradient);
  border-radius: 30rpx;
  padding: 28rpx;
}

.preview-avatar {
  width: 112rpx;
  height: 112rpx;
  display: flex;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  flex-shrink: 0;
  background: var(--gradient-brand);
  margin-right: 24rpx;
}

.preview-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.preview-name {
  display: block;
  font-size: 36rpx;
  color: var(--fg);
  font-weight: 500;
  margin-bottom: 8rpx;
}

.preview-meta {
  display: block;
  font-size: 26rpx;
  color: var(--fg-muted);
}

.import-btn {
  margin: 16rpx 0 0;
  padding: 18rpx 40rpx;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: var(--fg);
  background: var(--bg-input);
  border: none;
}

.import-btn::after {
  border: none;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  height: 96rpx;
  border-radius: 48rpx !important;
  margin: 0 0 16rpx;
  padding: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1;
  color: #0A0A0A;
  border: none;
}

.submit-btn::after {
  border: none;
}

.submit-btn[disabled] {
  background: var(--bg-card) !important;
  color: var(--fg-muted) !important;
  border: 2rpx solid var(--border) !important;
  opacity: 1 !important;
}

/* Auto Fill 按钮 */
.autofill-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: #0A0A0A;
  background: var(--gradient-brand);
  border: none;
  border-radius: 24px;
  padding: 14rpx 20rpx;
}

.autofill-btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.autofill-icon {
  font-size: 24rpx;
}

.autofill-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.autofill-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--bg-card, #1a1a2e);
  border-radius: 32rpx;
  padding: 48rpx 72rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.4);
}

.loader-spinner {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--gradient-brand);
  position: relative;
  animation: spin 0.8s linear infinite;
  margin-bottom: 24rpx;
}

.loader-spinner::after {
  content: '';
  position: absolute;
  top: 6rpx;
  left: 6rpx;
  right: 6rpx;
  bottom: 6rpx;
  border-radius: 50%;
  background: var(--bg-card);
}

.loader-text {
  color: var(--fg);
  font-size: 28rpx;
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

export interface FilterResult {
  isSafe: boolean;
  reason?: string; // 차단 사유 (예: 비속어 검출, 무의미한 텍스트 반복 등)
  suggestedText?: string; // 대안 텍스트 추천 (선택 사항)
}

async function requestGemini(task: 'filter' | 'analysis', prompt: string, jsonMode = false): Promise<string> {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, prompt, jsonMode }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text) {
    throw new Error('Gemini API returned an empty response.');
  }

  return data.text;
}

// 로컬 차단 욕설 및 비속어 목록
const KOREAN_SWEARS = [
  '존나', '존내', '개새끼', '새끼', '씨발', '시발', '썅', '지랄', '병신', '엠창', '호로', '또라이', '뒈져', '닥쳐',
  '대가리', '머가리', '꺼져', '빡대가리', '좃', '좆', '씹', '랄지', '조까', '존맛', '개같', '미친'
];

/**
 * 1차로 로컬에서 욕설, 자모음 반복, 키보드 연타를 즉시 감지하여 차단합니다.
 * API 호출 전에 실행되어 빠른 속도와 안정성을 보장합니다.
 */
function localFilterCheck(text: string): FilterResult | null {
  const normalized = text.replace(/\s+/g, '').toLowerCase();

  // 1. 욕설 검출
  for (const swear of KOREAN_SWEARS) {
    if (normalized.includes(swear)) {
      return {
        isSafe: false,
        reason: '친구에게 상처를 줄 수 있는 거친 표현이나 욕설이 포함되어 있어요. 고운 말을 사용해 보아요!',
        suggestedText: text.replace(new RegExp(swear, 'gi'), '○○')
      };
    }
  }

  // 2. 무의미한 자모음 연타 및 문자 반복 검출 (예: ㅋㅋㅋㅋ, ㅎㅎㅎㅎ, ㅠㅠㅠㅠ)
  // 임의의 한 문자(자음, 모음, 알파벳 포함)가 4번 이상 연속 반복되는 경우 감지
  const repeatedCharRegex = /([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9])\1{3,}/;
  if (repeatedCharRegex.test(normalized)) {
    return {
      isSafe: false,
      reason: '똑같은 글자가 너무 여러 번 반복되었어요. 이야기의 흐름을 잇는 올바른 문장으로 다시 써 주세요!',
      suggestedText: text.replace(/([ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9])\1{3,}/g, '$1')
    };
  }

  // 3. 키보드 연타 (ㅁㄴㅇㄹ, ㄴㅇㄹㄴㅇ, asdf 등)
  const keymashPatterns = [
    'ㅁㄴㅇㄹ', 'ㄴㅇㄹㄴ', 'ㅇㄹㄴㅇ', 'ㄹㄴㅇㄹ', 'asdf', 'sdfg', 'dfgh', 'hjkl', 'qwer'
  ];
  for (const mash of keymashPatterns) {
    if (normalized.includes(mash)) {
      return {
        isSafe: false,
        reason: '의미가 없거나 장난치는 글자가 포함되어 있어요. 친구들이 이해할 수 있는 올바른 이야기를 써 주세요!',
        suggestedText: ''
      };
    }
  }

  // 4. 단독 자음/모음 및 너무 짧은 입력 차단
  if (text.trim().length <= 1) {
    const singleChar = text.trim();
    const isKoreanChar = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(singleChar);
    if (isKoreanChar) {
      return {
        isSafe: false,
        reason: '한 글자만 쓰면 이야기가 이어지기 어려워요! 한 문장으로 조금 더 자세히 표현해 볼까요?',
        suggestedText: singleChar + '했습니다.'
      };
    }
  }

  return null;
}

/**
 * Gemini API와 로컬 필터를 결합하여 문장을 실시간 검사합니다.
 */
export async function filterSentence(text: string): Promise<FilterResult> {
  // 1. 로컬 필터 즉시 검사 (최우선순위)
  const localResult = localFilterCheck(text);
  if (localResult) {
    return localResult;
  }

  try {
    const prompt = `
당신은 초등학교 4학년 대상의 협동 글쓰기(이야기 릴레이) 수업을 지도하는 인공지능 교사 도우미입니다.
학생이 제출한 문장에 대해 다음 사항을 평가하고 결과를 오직 **JSON 형식**으로만 응답해 주세요.

[평가 기준]
1. 욕설, 비속어, 비하하는 단어, 사이버 불링(누군가를 놀리거나 따돌리는 표현)이 포함되어 있는가?
2. 한글 자모음의 무의미한 단순 반복(예: ㅋㅋㅋㅋ, ㅎㅎㅎㅎ, ㄱㄱㄱ, ㅠㅠㅠ, ㅁㄴㅇㄹ), 혹은 아무 뜻이 없는 영문/기호 나열, 한 단어의 도배 등 이야기의 흐름을 방해하고 장난치는 글인가?
3. 문장이라고 보기 어려운 너무 짧은 단편적인 입력인가? (예: "아", "네", "음" 단독 입력. 단, 앞뒤 문맥 없이 혼자 단독으로 들어온 경우에 한함)

[출력 JSON 규격]
{
  "isSafe": true 또는 false (안전하고 올바른 이야기 문장이면 true, 필터링되어 차단되어야 하면 false),
  "reason": "차단된 이유 설명 (한국어로 친절하게 초등학생 눈높이에 맞게 설명. 예: '욕설이나 거친 표현이 포함되어 있어요.', '뜻이 없는 글자가 너무 많이 반복되었어요.')",
  "suggestedText": "차단되었을 경우, 학생이 전하려던 원래 의도를 짐작하여 순화된 바른 문장 하나를 추천해 줍니다. 안전한 문장이면 비워둡니다."
}

[학생 입력 문장]
"${text.replace(/"/g, '\\"')}"

[JSON 응답]`;

    const responseText = await requestGemini('filter', prompt, true);
    const parsed: FilterResult = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    console.error("Gemini API Error in filtering:", error);
    // API 에러 시에도 일단 통과하되, 로컬에서 거른 단어가 아닌 이상 안전한 것으로 간주
    return { isSafe: true };
  }
}

/**
 * 학생들이 완성한 이야기 및 활동 내역을 Gemini API를 통해 교육적 기준으로 분석합니다.
 */
export async function analyzeStoryAI(
  sentences: { writer: string; text: string }[],
  students: string[],
  warningLogs?: { nickname: string; text: string; reason: string; timestamp: number }[]
): Promise<string> {
  try {
    const storyText = sentences.map((s, idx) => `${idx + 1}. [${s.writer}] ${s.text}`).join('\n');
    const studentList = students.join(', ');
    const warningsText = warningLogs && warningLogs.length > 0 
      ? warningLogs.map((w, idx) => `${idx + 1}. [${w.nickname}] "${w.text}" (${w.reason})`).join('\n')
      : '없음';

    const prompt = `
당신은 초등학교 4학년 국어 수업에서 학생들의 릴레이 소설(협동 글쓰기) 활동을 실시간으로 분석하고 평가 피드백을 작성해주는 전문 수석 교사입니다.
모둠 학생들이 협력하여 만든 소설 본문과 참여 학생 목록, 필터링 경고 로그를 바탕으로 이 활동을 다각도로 분석해 주세요.

초등학교 4학년 수준에 적합하도록 따뜻하고 격려하는 어조로 작성하되, 교사가 학생 지도에 활용하거나 생활기록부/평가 기록에 그대로 활용할 수 있도록 전문적인 분석을 제공해 주세요.

[모둠 정보]
- 참여 학생: ${studentList}
- 작성된 소설 내용:
${storyText || '(작성된 문장이 없습니다.)'}

- AI 필터링 경고 내역:
${warningsText}

다음 네 가지 항목을 포함하여 가독성 좋은 마크다운(Markdown) 형식으로 최종 분석 보고서를 응답해 주세요.

1. **🤝 모둠 협동성 분석**
   - 앞 사람의 문장을 이어받아 이야기를 매끄럽게 연결하려는 노력이 돋보인 부분(구체적인 문장 번호 언급)을 칭찬해 주세요.
   - 턴 진행이 원활했는지, 학생들이 골고루 참여했는지 설명해 주세요.

2. **💡 소설의 창의성 및 이야기 흐름**
   - 이야기의 소재나 전개에서 창의성이 돋보인 부분은 무엇인지 분석해 주세요.
   - 이야기의 처음-가운데-끝 흐름이 자연스러운지 평가해 주세요.

3. **📝 올바른 언어 사용 및 맞춤법 피드백**
   - 4학년 수준에서 발견되는 아쉬운 맞춤법, 띄어쓰기, 문장 성분의 호응(예: 주어와 서술어의 호응)이 있다면 교정 제안을 포함해 지적해 주세요.
   - 비속어나 무의미한 텍스트로 경고를 받은 내역이 있다면, 이에 대한 지도 방향성도 짧게 제안해 주세요.

4. **👨‍🏫 교사용 추천 종합 피드백**
   - 교사가 생활기록부나 피드백란에 입력하기 좋은 모둠 전체 및 개별 핵심 학생에 대한 종합 피드백 코멘트를 3~4줄로 제안해 주세요.

응답은 마크다운 문법으로 바로 렌더링할 수 있도록 작성해 주세요. (예: ##, 1., 2., *, bold 등 활용)`;

    return await requestGemini('analysis', prompt);
  } catch (error) {
    console.error("Gemini API Error in analysis, falling back to simulation:", error);
    return `### 🤖 AI 모둠 활동 분석 보고서 (로컬 시뮬레이션 - API 오류 대체)

> [!WARNING]
> Gemini API 호출 중 오류가 발생하여(API 키 오류 또는 네트워크 문제), 로컬 시뮬레이션 분석 보고서로 대체 제공합니다.

#### 🤝 1. 모둠 협동성 분석
- **활동 참여도**: 참여 학생(${students.join(', ')})이 서로 순서를 존중하며 안정적으로 작성에 동참했습니다.
- **문장 연결성**: 앞사람의 문장 흐름을 유지하며 글을 완성하고자 힘썼습니다.
- **보완 제안**: 순서 대기 중에 친구의 글을 조금 더 집중해서 읽을 수 있도록 지도해 주세요.

#### 💡 2. 소설의 창의성 및 이야기 흐름
- **소재의 독창성**: 4학년 수준에서 접근하기 쉬운 흥미로운 소재를 활용했습니다.
- **이야기 구조**: 처음(시작)-가운데(사건)-끝(결말)의 기본 흐름을 구성하려고 노력했습니다.

#### 📝 3. 올바른 언어 사용 및 맞춤법 피드백
- **비속어/장난 내역**: ${warningLogs && warningLogs.length > 0 ? `경고가 총 ${warningLogs.length}회 감지되었습니다. 욕설이나 반복적인 문체 사용에 대한 지도 편달이 필요합니다.` : '감지된 비속어나 장난 문장이 없어 매우 훌륭합니다.'}
- **맞춤법 개선**: 띄어쓰기 및 마침표 사용 등 기본적인 국어 작문 습관을 한 번 더 보듬어 주시면 좋습니다.

#### 👨‍🏫 4. 교사용 추천 종합 피드백
- **피드백 제안**: "친구들의 생각을 잘 엮어서 멋진 릴레이 이야기를 완성해 냈네요! 모둠 친구들이 함께 상상력을 키우며 협동하는 모습이 참 아름답습니다. 다음에는 문장 간의 호응을 생각하며 더 풍부한 표현을 사용해 봅시다."`;
  }
}

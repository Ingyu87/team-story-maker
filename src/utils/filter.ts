import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export interface FilterResult {
  isSafe: boolean;
  reason?: string; // 차단 사유 (예: 비속어 검출, 무의미한 텍스트 반복 등)
  suggestedText?: string; // 대안 텍스트 추천 (선택 사항)
}

/**
 * Gemini API를 활용하여 초등학생이 입력한 문장을 실시간 검사합니다.
 * 욕설, 비속어, 사이버 불링, 혹은 의미 없는 단순 자음/모음 반복(예: ㅋㅋㅋㅋ, ㄴㅇㄹㄴㅇ)을 필터링합니다.
 */
export async function filterSentence(text: string): Promise<FilterResult> {
  if (!apiKey) {
    console.warn("Gemini API Key is missing. Skipping filter check.");
    return { isSafe: true };
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    // gemini-2.5-flash 또는 gemini-1.5-flash 등 적절한 모델 사용
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const parsed: FilterResult = JSON.parse(responseText);
    return parsed;
  } catch (error) {
    console.error("Gemini API Error in filtering:", error);
    // API 에러 시 일단은 넘어가되 로그를 찍음 (개발 편의성 및 안정성 목적)
    return { isSafe: true };
  }
}

// 태그 id 배열을 [{id, name}] 배열로 변환 (전체 태그 목록 필요)
export function tagIdsToObjects(tagIds, allTags) {
  return tagIds
    .map(id => allTags.find(t => t.id === id))
    .filter(Boolean);
}

// 태그 name 배열을 [{id, name}] 배열로 변환 (전체 태그 목록 필요)
export function tagNamesToObjects(tagNames, allTags) {
  return tagNames
    .map(name => allTags.find(t => t.name === name))
    .filter(Boolean);
}

// 중복/부분문자열/2글자 이상 체크
export function isValidTagInput(input, selectedTags) {
  if (input.trim().length < 2) return false;
  if (selectedTags.includes(input)) return false;
  if (selectedTags.some(t => t === input || input.includes(t) || t.includes(input))) return false;
  return true;
}

// 에러 메시지 추출 (API 응답에서)
export function extractErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error.detail && error.detail.error) return error.detail.error;
  if (error.message) return error.message;
  return '알 수 없는 오류가 발생했습니다.';
} 
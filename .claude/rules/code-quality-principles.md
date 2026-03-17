# 코드 품질 4원칙

> 코드 품질 원칙 설명문을 팀 규칙/스킬 실행 규칙으로 변환한 기준이다.
> 출처: lhg code-quality-principles.md

---

## 1) 가독성

- 동시에 실행되지 않는 분기는 컴포넌트/함수로 분리한다.
- 구현 상세는 이름 있는 함수/훅으로 추상화한다.
- 조건식과 매직 넘버에 이름을 부여한다.
- 시점 이동을 줄이고 위에서 아래로 읽히도록 배치한다.

```tsx
// BAD
function SubmitButton() {
  const isViewer = useRole() === "viewer"
  useEffect(() => { if (!isViewer) showAnimation() }, [isViewer])
  return isViewer ? <TextButton disabled>Submit</TextButton> : <Button type="submit">Submit</Button>
}

// GOOD
function SubmitButton() {
  const isViewer = useRole() === "viewer"
  return isViewer ? <ViewerSubmitButton /> : <AdminSubmitButton />
}

function ViewerSubmitButton() {
  return <TextButton disabled>Submit</TextButton>
}

function AdminSubmitButton() {
  useEffect(() => { showAnimation() }, [])
  return <Button type="submit">Submit</Button>
}
```

---

## 2) 예측 가능성

- 함수/컴포넌트 이름과 반환 형태를 일관되게 유지한다.
- 같은 역할의 훅/유틸은 입력/출력 타입 규약을 통일한다.
- 숨은 부수효과를 줄이고 명시적 흐름으로 드러낸다.

```ts
// BAD
function loadPrompt(id: string): any {
  if (!id) return null
  try { return fetchPrompt(id) }
  catch { return false }
}

// GOOD
type LoadResult<T> = { ok: true; data: T } | { ok: false; message: string }

async function loadPrompt(id: string): Promise<LoadResult<Prompt>> {
  if (!id) return { ok: false, message: "id is required" }
  try {
    const data = await fetchPrompt(id)
    return { ok: true, data }
  } catch {
    return { ok: false, message: "load failed" }
  }
}
```

---

## 3) 응집도

- 함께 수정되는 코드는 같은 디렉터리와 같은 모듈 경계에 둔다.
- 공유해야 하는 규칙만 공통화하고, 불필요한 공통화는 피한다.
- 폼/상태/검증 로직은 분리하되 함께 바뀌는 단위는 묶는다.

```
// BAD: 한 파일에 form schema + submit mapper + query key + validation 혼재

// GOOD: 같은 폴더에 역할별 분리
FormView.tsx
useFormState.ts
formSchema.ts
toPayload.ts
```

---

## 4) 결합도

- 수정 영향 범위를 줄이기 위해 책임을 단일화한다.
- 과도한 추상화보다 제한된 중복을 허용한다.
- Props Drilling이 과도해지면 컨텍스트/상태 경계를 재설계한다.

```tsx
// BAD: Props Drilling
function Page() {
  const [value, setValue] = useState("")
  return <Section value={value} setValue={setValue} />
}

// GOOD: Context 분리
const FormContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null)

function Page() {
  const [value, setValue] = useState("")
  return (
    <FormContext.Provider value={{ value, setValue }}>
      <Section />
    </FormContext.Provider>
  )
}
```

---

## 적용 원칙

- 위험도가 **높은** 영역 → 응집도 우선
- 위험도가 **낮은** 영역 → 가독성 우선
- 최적화보다 **이해 가능한 구조를 먼저** 확보

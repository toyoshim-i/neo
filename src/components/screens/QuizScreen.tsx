import {
  CheckCircle2,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { QuizQuestion, TrainingPassage } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';
import { OperatorMonitor, OperatorState } from '../quiz/OperatorMonitor';

interface QuizScreenProps {
  operatorState: OperatorState;
  lastResponseSec: number | null;
  activeQuizQuestions: QuizQuestion[];
  selectedPassage: TrainingPassage;
  quizIndex: number;
  selectedOption: number | null;
  onSelectQuizOption: (idx: number) => void;
  onNextQuizStep: () => void;
}

export function QuizScreen({
  operatorState,
  lastResponseSec,
  activeQuizQuestions,
  selectedPassage,
  quizIndex,
  selectedOption,
  onSelectQuizOption,
  onNextQuizStep,
}: QuizScreenProps) {
  const quizList =
    activeQuizQuestions.length > 0
      ? activeQuizQuestions
      : selectedPassage.questions;
  const q = quizList[quizIndex] || selectedPassage.questions[0];

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center space-y-5">
      <OperatorMonitor state={operatorState} responseTimeSec={lastResponseSec} />

      <ChamferedPanel
        variant="yellow"
        cutSize={12}
        tag={q.code}
        title={`COMPREHENSION CHECK // QUESTION ${quizIndex + 1} OF ${
          quizList.length
        }`}
      >
        <div className="p-6 space-y-5">
          <h2 className="text-base sm:text-lg font-bold text-[#F2F5F8] leading-relaxed whitespace-pre-line">
            {q.question.replace(/:\s+"/, ':\n"')}
          </h2>

          <div className="space-y-2.5">
            {q.options.map((opt, idx) => {
              const isPicked = selectedOption === idx;
              const isCorrectOption = idx === q.correctIndex;
              let cardStyle =
                'bg-[#0D0618] border-[#6C7A89]/40 text-[#F2F5F8] hover:border-[#FFE600]';

              if (selectedOption !== null) {
                if (isCorrectOption) {
                  cardStyle =
                    'bg-[#00F5D4]/15 border-[#00F5D4] text-[#00F5D4] font-semibold';
                } else if (isPicked) {
                  cardStyle =
                    'bg-[#FF1E7A]/15 border-[#FF1E7A] text-[#FF1E7A]';
                } else {
                  cardStyle =
                    'bg-[#0D0618] border-[#6C7A89]/20 text-[#6C7A89] opacity-50';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={selectedOption !== null}
                  onClick={() => onSelectQuizOption(idx)}
                  className={`cyber-btn w-full p-3.5 border text-left text-sm flex items-start gap-3 transition-all ${cardStyle}`}
                >
                  <span className="font-terminal text-xs px-1.5 py-0.5 bg-[#180B29] border border-current shrink-0">
                    0{idx + 1}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {selectedOption !== null && isCorrectOption && (
                    <CheckCircle2 className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
                  )}
                  {selectedOption !== null && isPicked && !isCorrectOption && (
                    <XCircle className="w-4 h-4 text-[#FF1E7A] shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <div className="pt-4 border-t border-[#FFE600]/20 space-y-4">
              <p className="text-xs text-[#6C7A89] leading-relaxed whitespace-pre-line">
                <strong className="text-[#F2F5F8] font-terminal mr-1.5">
                  ANALYSIS:
                </strong>
                {q.explanation.replace(/:\s+"/, ':\n"')}
              </p>

              <button
                type="button"
                onClick={onNextQuizStep}
                className="cyber-btn w-full py-3 bg-[#FFE600] text-[#0D0618] font-bold text-sm flex items-center justify-center gap-2"
              >
                <span>
                  {quizIndex < quizList.length - 1
                    ? 'NEXT QUESTION [ENTER]'
                    : 'VIEW SESSION RESULT [ENTER]'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </ChamferedPanel>
    </main>
  );
}

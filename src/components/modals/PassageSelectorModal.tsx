import { FileText, Globe, Loader2, X } from 'lucide-react';
import { PassageModalTab } from '../../lib/pacing';
import { soundEngine } from '../../lib/soundEngine';
import { TrainingPassage, UserProfile } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface PassageSelectorModalProps {
  allPassages: TrainingPassage[];
  selectedPassage: TrainingPassage;
  profile: UserProfile;
  passageModalTab: PassageModalTab;
  setPassageModalTab: (tab: PassageModalTab) => void;
  isFetchingFeed: boolean;
  feedStatusMsg: string;
  customTitle: string;
  setCustomTitle: (title: string) => void;
  customRawText: string;
  setCustomRawText: (text: string) => void;
  onSelectPassage: (passageId: string) => void;
  onFetchLivePassage: (source: 'wikipedia' | 'wikipedia_art' | 'devto') => void;
  onCreateCustomPassage: () => void;
  onClose: () => void;
}

export function PassageSelectorModal({
  allPassages,
  selectedPassage,
  profile,
  passageModalTab,
  setPassageModalTab,
  isFetchingFeed,
  feedStatusMsg,
  customTitle,
  setCustomTitle,
  customRawText,
  setCustomRawText,
  onSelectPassage,
  onFetchLivePassage,
  onCreateCustomPassage,
  onClose,
}: PassageSelectorModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <ChamferedPanel
          variant="cyan"
          cutSize={12}
          tag="CORPUS"
          title="SELECT OR FETCH PASSAGE"
          rightSlot={
            <button
              type="button"
              onClick={onClose}
              className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          }
        >
          <div className="p-4 space-y-4">
            {/* Modal Tabs */}
            <div className="grid grid-cols-3 gap-2 font-terminal text-xs">
              <button
                type="button"
                onClick={() => setPassageModalTab('presets')}
                className={`cyber-btn py-2 border font-bold ${
                  passageModalTab === 'presets'
                    ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                    : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                }`}
              >
                LIBRARY ({allPassages.length})
              </button>
              <button
                type="button"
                onClick={() => setPassageModalTab('live')}
                className={`cyber-btn py-2 border font-bold flex items-center justify-center gap-1.5 ${
                  passageModalTab === 'live'
                    ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                    : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>LIVE API</span>
              </button>
              <button
                type="button"
                onClick={() => setPassageModalTab('custom')}
                className={`cyber-btn py-2 border font-bold flex items-center justify-center gap-1.5 ${
                  passageModalTab === 'custom'
                    ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                    : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PASTE TEXT</span>
              </button>
            </div>

            {/* Tab 1: Preset & Saved Library with Play History & Speed Badges */}
            {passageModalTab === 'presets' && (
              <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                {allPassages.map((passage, idx) => {
                  const isSelected = passage.id === selectedPassage.id;
                  const rec = profile.passageRecords?.[passage.id];
                  const hasPlayed = Boolean(rec && rec.attempts > 0);
                  const stage = rec?.stageCompleted || 0;
                  const bestEwpm = rec?.bestEffectiveWpm || 0;

                  return (
                    <button
                      key={passage.id}
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        onSelectPassage(passage.id);
                        onClose();
                      }}
                      className={`cyber-btn w-full p-3.5 border text-left transition-all ${
                        isSelected
                          ? 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#F2F5F8]'
                          : 'bg-[#0D0618] border-[#6C7A89]/40 text-[#6C7A89] hover:border-[#00F5D4]/60 hover:text-[#F2F5F8]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 font-terminal text-xs">
                        <span className="text-[#00F5D4] font-bold">
                          {String(idx + 1).padStart(2, '0')} //{' '}
                          {passage.category}
                        </span>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {stage >= 3 ? (
                            <span className="px-1.5 py-0.5 bg-[#FF1E7A]/20 border border-[#FF1E7A] text-[#FF1E7A] font-bold">
                              ★ MASTERED (3/3)
                            </span>
                          ) : hasPlayed ? (
                            <span className="px-1.5 py-0.5 bg-[#00F5D4]/15 border border-[#00F5D4]/60 text-[#00F5D4] font-bold">
                              STAGE {stage}/3 · {rec?.attempts} RUN
                              {(rec?.attempts || 0) > 1 ? 'S' : ''}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-[#180B29] border border-[#6C7A89]/40 text-[#6C7A89]">
                              UNREAD (85% PACE)
                            </span>
                          )}

                          {bestEwpm > 0 && (
                            <span className="px-1.5 py-0.5 bg-[#FFE600]/15 border border-[#FFE600] text-[#FFE600] font-bold">
                              BEST: {bestEwpm} eWPM
                            </span>
                          )}

                          <span className="text-[#6C7A89]">
                            {passage.wordCount}w
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-[#F2F5F8] mt-1">
                        {passage.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Live API Fetch (Wikipedia / Dev.to) */}
            {passageModalTab === 'live' && (
              <div className="space-y-3 py-2">
                <p className="text-xs text-[#6C7A89]">
                  Fetch a live English article and automatically segment it
                  into semantic chunks with 3 comprehension questions.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={isFetchingFeed}
                    onClick={() => onFetchLivePassage('wikipedia')}
                    className="cyber-btn p-4 bg-[#0D0618] border border-[#00F5D4] text-left hover:bg-[#00F5D4]/15"
                  >
                    <div className="font-terminal text-xs font-bold text-[#00F5D4]">
                      WIKIPEDIA RANDOM
                    </div>
                    <div className="text-xs text-[#6C7A89] mt-1">
                      ~150–280 word general encyclopedia summary.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isFetchingFeed}
                    onClick={() => onFetchLivePassage('wikipedia_art')}
                    className="cyber-btn p-4 bg-[#0D0618] border border-[#FF1E7A] text-left hover:bg-[#FF1E7A]/15"
                  >
                    <div className="font-terminal text-xs font-bold text-[#FF1E7A]">
                      ART &amp; AESTHETICS
                    </div>
                    <div className="text-xs text-[#6C7A89] mt-1">
                      Curated painting, architecture, music &amp; film theory.
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isFetchingFeed}
                    onClick={() => onFetchLivePassage('devto')}
                    className="cyber-btn p-4 bg-[#0D0618] border border-[#FFE600] text-left hover:bg-[#FFE600]/15"
                  >
                    <div className="font-terminal text-xs font-bold text-[#FFE600]">
                      DEV.TO TECH ARTICLE
                    </div>
                    <div className="text-xs text-[#6C7A89] mt-1">
                      ~250 word excerpt from software engineering posts.
                    </div>
                  </button>
                </div>

                {feedStatusMsg && (
                  <div className="p-3 bg-[#0D0618] border border-[#00F5D4]/40 font-terminal text-xs text-[#00F5D4] flex items-center gap-2">
                    {isFetchingFeed && (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    )}
                    <span>{feedStatusMsg}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Paste Custom Text */}
            {passageModalTab === 'custom' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Passage Title (optional)"
                  className="w-full px-3 py-2 bg-[#0D0618] border border-[#6C7A89]/50 text-xs font-terminal text-[#F2F5F8] focus:border-[#00F5D4] focus:outline-none"
                />
                <textarea
                  rows={5}
                  value={customRawText}
                  onChange={(e) => setCustomRawText(e.target.value)}
                  placeholder="Paste any English article, paper abstract, or documentation here (min 25 words)..."
                  className="w-full p-3 bg-[#0D0618] border border-[#6C7A89]/50 text-xs text-[#F2F5F8] focus:border-[#00F5D4] focus:outline-none"
                />
                {feedStatusMsg && (
                  <div className="text-xs font-terminal text-[#FFE600]">
                    {feedStatusMsg}
                  </div>
                )}
                <button
                  type="button"
                  disabled={isFetchingFeed}
                  onClick={onCreateCustomPassage}
                  className="cyber-btn w-full py-2.5 bg-[#00F5D4] text-[#0D0618] font-bold text-xs"
                >
                  {isFetchingFeed
                    ? 'PROCESSING...'
                    : 'GENERATE CHUNKS & SELECT PASSAGE'}
                </button>
              </div>
            )}
          </div>
        </ChamferedPanel>
      </div>
    </div>
  );
}

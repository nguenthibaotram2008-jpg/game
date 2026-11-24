import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapPin,
  Search,
  EyeOff,
  RotateCcw,
  Compass,
  Award,
  Layers,
  X,
  Volume2,
  VolumeX,
  Map,
} from 'lucide-react';
import {
  AudioScale,
  DaNangLandmark,
  GameMode,
  GameState,
  LandmarkArtId,
  Language,
} from './types/game';
import { DANANG_LANDMARKS } from './data/landmarks';
import { soundFx } from './audio/soundFx';
import { TowerCanvas, DropOutcome } from './components/TowerCanvas';
import { MusicLabPanel } from './components/MusicLabPanel';
import { LandmarkAtlasModal } from './components/LandmarkAtlasModal';
import { LandmarkDetailModal } from './components/LandmarkDetailModal';
import { MascotDetailModal } from './components/MascotDetailModal';
import {
  DaNangLandmarkModel,
  GdgocMascotSticker,
  loadCleanLandmarkCutout,
} from './components/DaNangLandmarkModel';

const STORAGE_BEST_SCORE = 'stacklab_danang_best_score_v1';
const STORAGE_UNLOCKED_LANDMARKS = 'stacklab_danang_unlocked_v1';

export default function App() {
  const [language, setLanguage] = useState<Language>('vi');
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [gameMode, setGameMode] = useState<GameMode>('DANANG');

  // Score & progression
  const [score, setScore] = useState<number>(0);
  const [floor, setFloor] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BEST_SCORE);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [comboStreak, setComboStreak] = useState<number>(0);
  const [maxComboRun, setMaxComboRun] = useState<number>(0);
  const [perfectCountRun, setPerfectCountRun] = useState<number>(0);

  // Landmarks
  const [unlockedLandmarkIds, setUnlockedLandmarkIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_UNLOCKED_LANDMARKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [inspectedLandmark, setInspectedLandmark] = useState<DaNangLandmark | null>(null);
  const [activeToast, setActiveToast] = useState<{
    kind: 'landmark' | 'did_you_mean' | 'incognito';
    title: string;
    subtitle: string;
    accent?: string;
    landmarkId?: LandmarkArtId;
    landmarkObj?: DaNangLandmark;
  } | null>(null);

  // Google Easter Egg Power-ups
  const [didYouMeanCharges, setDidYouMeanCharges] = useState<number>(1);
  const [didYouMeanArmed, setDidYouMeanArmed] = useState<boolean>(false);
  const [incognitoCharges, setIncognitoCharges] = useState<number>(1);
  const [incognitoBlocksLeft, setIncognitoBlocksLeft] = useState<number>(0);

  // Sound FX state (no background music)
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [scale, setScale] = useState<AudioScale>('major');
  const [lastNoteName, setLastNoteName] = useState<string>('');

  // Signals & Modals
  const [dropSignal, setDropSignal] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [atlasOpen, setAtlasOpen] = useState<boolean>(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [mascotOpen, setMascotOpen] = useState<boolean>(false);

  const isIncognito = incognitoBlocksLeft > 0;
  const isCanvasPaused = Boolean(inspectedLandmark || atlasOpen || guideOpen || mascotOpen);

  useEffect(() => {
    soundFx.setIncognitoFilter(isIncognito);
  }, [isIncognito]);

  useEffect(() => {
    DANANG_LANDMARKS.forEach((lm) => {
      void loadCleanLandmarkCutout(lm.id);
    });
  }, []);

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => setActiveToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  const showToast = useCallback(
    (toast: {
      kind: 'landmark' | 'did_you_mean' | 'incognito';
      title: string;
      subtitle: string;
      accent?: string;
      landmarkId?: LandmarkArtId;
      landmarkObj?: DaNangLandmark;
    }) => {
      setActiveToast(toast);
    },
    []
  );

  const handleOpenLandmarkPopup = useCallback((landmark: DaNangLandmark) => {
    soundFx.playPopupTap();
    setInspectedLandmark(landmark);
  }, []);

  const handleOpenMascotPopup = useCallback(() => {
    soundFx.playMascotTap();
    setMascotOpen(true);
  }, []);

  const startNewGame = useCallback(() => {
    soundFx.unlock();
    soundFx.playStart();

    setScore(0);
    setFloor(0);
    setComboStreak(0);
    setMaxComboRun(0);
    setPerfectCountRun(0);
    setDidYouMeanCharges(1);
    setDidYouMeanArmed(false);
    setIncognitoCharges(1);
    setIncognitoBlocksLeft(0);
    setLastNoteName('');
    setActiveToast(null);
    setInspectedLandmark(null);
    setResetSignal((n) => n + 1);
    setGameState('PLAYING');
  }, []);

  const armDidYouMean = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    if (didYouMeanArmed) {
      setDidYouMeanArmed(false);
      return;
    }
    if (didYouMeanCharges <= 0) return;
    setDidYouMeanArmed(true);
    soundFx.playAutoCorrectChime();
    showToast({
      kind: 'did_you_mean',
      title: 'Did you mean: Perfect?',
      subtitle:
        language === 'vi'
          ? 'Đã bật Auto-Correct cho nhịp thả kế tiếp!'
          : 'Auto-Correct armed for your next block drop!',
      accent: '#2563EB',
    });
  }, [didYouMeanArmed, didYouMeanCharges, gameState, language, showToast]);

  const consumeDidYouMean = useCallback(() => {
    setDidYouMeanArmed(false);
    setDidYouMeanCharges((c) => Math.max(0, c - 1));
    soundFx.playAutoCorrectChime();
  }, []);

  const activateIncognito = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    if (incognitoBlocksLeft > 0 || incognitoCharges <= 0) return;
    setIncognitoCharges((c) => Math.max(0, c - 1));
    setIncognitoBlocksLeft(6);
    soundFx.playIncognitoToggle(true);
    showToast({
      kind: 'incognito',
      title: 'Incognito Mode',
      subtitle:
        language === 'vi'
          ? '6 tầng tiếp theo: Tốc độ -35%, vùng Perfect +55%, điểm x2!'
          : 'Next 6 blocks: -35% speed, +55% Perfect zone, 2x score!',
      accent: '#38BDF8',
    });
  }, [gameState, incognitoBlocksLeft, incognitoCharges, language, showToast]);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    soundFx.setMuted(next);
  }, [isMuted]);

  const handleChangeScale = useCallback((nextScale: AudioScale) => {
    setScale(nextScale);
    soundFx.setScale(nextScale);
    soundFx.playScalePreview();
  }, []);

  const handleDropOutcome = useCallback(
    (outcome: DropOutcome) => {
      if (outcome.gameOver) {
        soundFx.playGameOver();
        setIncognitoBlocksLeft(0);
        setDidYouMeanArmed(false);
        setGameState('GAME_OVER');
        return;
      }

      setScore((prev) => {
        const nextScore = prev + outcome.pointsEarned;
        if (nextScore > bestScore) {
          setBestScore(nextScore);
          try {
            localStorage.setItem(STORAGE_BEST_SCORE, String(nextScore));
          } catch {
            // ignore
          }
        }
        return nextScore;
      });

      setFloor(outcome.floor);
      setComboStreak(outcome.comboStreak);
      setMaxComboRun((m) => Math.max(m, outcome.comboStreak));
      if (outcome.isPerfect) {
        setPerfectCountRun((c) => c + 1);
      }

      const noteName = soundFx.playBlockDrop(outcome.comboStreak, outcome.isPerfect);
      setLastNoteName(noteName);

      if (outcome.floor > 0 && outcome.floor % 10 === 0) {
        setDidYouMeanCharges((c) => Math.min(3, c + 1));
      }
      if ((outcome.floor > 0 && outcome.floor % 15 === 0) || outcome.comboStreak === 5) {
        setIncognitoCharges((c) => Math.min(3, c + 1));
      }

      if (incognitoBlocksLeft > 0) {
        const nextLeft = incognitoBlocksLeft - 1;
        setIncognitoBlocksLeft(nextLeft);
        if (nextLeft === 0) {
          soundFx.playIncognitoToggle(false);
        }
      }

      if (outcome.wasAutoCorrected) {
        showToast({
          kind: 'did_you_mean',
          title: 'Did you mean: Perfect?',
          subtitle:
            language === 'vi'
              ? 'Google đã tự căn thẳng & khôi phục độ rộng khối!'
              : 'Auto-aligned to Perfect & restored block width!',
          accent: '#2563EB',
        });
      }

      if (!outcome.reachedLandmark && outcome.floor > 0 && outcome.floor % 10 === 0) {
        soundFx.playLandmarkFanfare();
      }

      if (outcome.reachedLandmark) {
        const lm = outcome.reachedLandmark;
        soundFx.playLandmarkFanfare();
        setUnlockedLandmarkIds((prev) => {
          if (prev.includes(lm.id)) return prev;
          const updated = [...prev, lm.id];
          try {
            localStorage.setItem(STORAGE_UNLOCKED_LANDMARKS, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });

        showToast({
          kind: 'landmark',
          title: `${language === 'vi' ? lm.nameVi : lm.nameEn} · ${lm.altitudeMeters}m`,
          subtitle:
            language === 'vi'
              ? 'Chạm vào sticker để xem thông tin chi tiết!'
              : 'Tap the sticker to view landmark details!',
          accent: lm.accentHex,
          landmarkId: lm.id,
          landmarkObj: lm,
        });
      }
    },
    [bestScore, incognitoBlocksLeft, language, showToast]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inspectedLandmark || atlasOpen || guideOpen || mascotOpen) {
        if (e.key === 'Escape') {
          setInspectedLandmark(null);
          setAtlasOpen(false);
          setGuideOpen(false);
          setMascotOpen(false);
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'TITLE_MENU' || gameState === 'GAME_OVER') {
          startNewGame();
        } else if (gameState === 'PLAYING') {
          setDropSignal((s) => s + 1);
        }
      } else if (e.key === 'q' || e.key === 'Q') {
        armDidYouMean();
      } else if (e.key === 'e' || e.key === 'E') {
        activateIncognito();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activateIncognito,
    armDidYouMean,
    atlasOpen,
    gameState,
    guideOpen,
    handleToggleMute,
    inspectedLandmark,
    mascotOpen,
    startNewGame,
  ]);

  const { currentLandmark, nextLandmark, altitudeProgress } = useMemo(() => {
    let current: DaNangLandmark | null = null;
    let next: DaNangLandmark | null = null;
    for (const lm of DANANG_LANDMARKS) {
      if (floor >= lm.floor) {
        current = lm;
      } else if (!next) {
        next = lm;
      }
    }
    const prevFloor = current ? current.floor : 0;
    const targetFloor = next ? next.floor : prevFloor + 10;
    const pct = next
      ? Math.min(100, Math.max(0, ((floor - prevFloor) / (targetFloor - prevFloor)) * 100))
      : 100;
    return { currentLandmark: current, nextLandmark: next, altitudeProgress: pct };
  }, [floor]);

  const approxMeters = Math.round(floor * 3.8);

  return (
    <div
      className={`h-[100dvh] lg:h-auto lg:min-h-screen flex flex-col overflow-hidden lg:overflow-visible transition-colors duration-300 ${
        isIncognito ? 'bg-[#13151A] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* Top Bar: Compact 52px on mobile, 3-Zone Contract on desktop */}
      <header
        className={`shrink-0 border-b transition-colors ${
          isIncognito ? 'border-slate-800 bg-[#181A20]' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="mx-auto flex h-13 lg:h-auto max-w-[1440px] items-center justify-between gap-3 sm:gap-8 px-3.5 sm:px-6 lg:py-3.5">
          {/* Zone 1: Wordmark */}
          <span className="font-display text-base sm:text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            StackLab Đà Nẵng
          </span>

          {/* Zone 2: Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => setAtlasOpen(true)}
              className={`whitespace-nowrap shrink-0 hover:underline underline-offset-4 transition-colors ${
                isIncognito ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Bản đồ Đà Nẵng' : 'Da Nang Atlas'}
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className={`whitespace-nowrap shrink-0 hover:underline underline-offset-4 transition-colors ${
                isIncognito ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Cách tính điểm' : 'Scoring Guide'}
            </button>
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'vi' ? 'en' : 'vi'))}
              className={`whitespace-nowrap shrink-0 hover:underline underline-offset-4 transition-colors ${
                isIncognito ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Tiếng Việt / EN' : 'English / VI'}
            </button>
          </nav>

          {/* Zone 3: Mobile compact utility + Primary New Tower CTA */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setAtlasOpen(true)}
              className={`lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
                isIncognito
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={language === 'vi' ? 'Bản đồ 7 biểu tượng Đà Nẵng' : 'Da Nang Landmarks Atlas'}
            >
              <Map className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors ${
                isIncognito
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={isMuted ? 'Unmute SFX' : 'Mute SFX'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'vi' ? 'en' : 'vi'))}
              className={`lg:hidden min-h-[40px] px-2 text-xs font-semibold rounded-lg transition-colors ${
                isIncognito
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {language === 'vi' ? 'VI' : 'EN'}
            </button>

            <button
              type="button"
              onClick={startNewGame}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{language === 'vi' ? 'Chơi mới' : 'New Tower'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Workspace: Full-flex 100dvh on Mobile, 12-Col Studio on Desktop */}
      <main className="flex-1 min-h-0 flex flex-col lg:block mx-auto w-full max-w-[1440px] p-2 sm:p-4 lg:px-6 lg:py-5">
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:gap-5 lg:items-stretch">
          {/* Dominant Interactive Tower Canvas */}
          <div
            className={`relative flex-1 min-h-0 lg:col-span-8 lg:h-[calc(100vh-7.2rem)] lg:min-h-[600px] overflow-hidden rounded-2xl border shadow-xs ${
              isIncognito ? 'border-slate-700/80' : 'border-slate-200'
            }`}
          >
            <TowerCanvas
              gameState={gameState}
              gameMode={gameMode}
              language={language}
              isIncognito={isIncognito}
              isPaused={isCanvasPaused}
              didYouMeanArmed={didYouMeanArmed}
              onConsumeDidYouMean={consumeDidYouMean}
              onDropOutcome={handleDropOutcome}
              onSelectLandmark={handleOpenLandmarkPopup}
              onSelectMascot={handleOpenMascotPopup}
              onStartGame={startNewGame}
              dropSignal={dropSignal}
              resetSignal={resetSignal}
            />

            {/* Top-Center Score HUD */}
            {gameState === 'PLAYING' && (
              <div className="pointer-events-none absolute inset-x-0 top-3.5 sm:top-6 flex flex-col items-center text-center px-3">
                <div
                  className={`font-display tabular-nums text-5xl sm:text-7xl font-bold tracking-tight leading-none ${
                    isIncognito ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {score}
                </div>
                <div
                  className={`mt-1.5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium font-mono-tabular ${
                    isIncognito ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  <span>{language === 'vi' ? `Tầng ${floor}` : `Floor ${floor}`}</span>
                  <span aria-hidden="true">·</span>
                  <span>{approxMeters}m</span>
                  {comboStreak > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isIncognito ? 'text-sky-400 font-semibold' : 'text-amber-600 font-semibold'
                        }
                      >
                        Perfect {comboStreak}x (+{comboStreak >= 5 ? 6 : comboStreak >= 3 ? 5 : comboStreak === 2 ? 4 : 3})
                      </span>
                    </>
                  )}
                  {isIncognito && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-400 font-semibold">
                        Incognito 2x ({incognitoBlocksLeft})
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tappable Milestone / Power-Up Toast */}
            {activeToast && gameState === 'PLAYING' && (
              <button
                type="button"
                onClick={() => {
                  if (activeToast.landmarkObj) {
                    handleOpenLandmarkPopup(activeToast.landmarkObj);
                  }
                }}
                className={`absolute top-[90px] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[310px] sm:left-auto sm:translate-x-0 sm:top-5 sm:right-5 sm:w-auto sm:max-w-xs rounded-xl border p-2.5 sm:p-3 text-left shadow-md transition-all ${
                  activeToast.landmarkObj ? 'cursor-pointer' : 'pointer-events-none'
                } ${
                  isIncognito
                    ? 'border-slate-700 bg-[#20232A]/95 text-slate-100'
                    : 'border-slate-200 bg-white/95 text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {activeToast.landmarkId ? (
                    <DaNangLandmarkModel
                      id={activeToast.landmarkId}
                      className="h-11 w-14 shrink-0"
                    />
                  ) : (
                    <MapPin
                      className="h-4 w-4 shrink-0"
                      style={{ color: activeToast.accent || '#2563EB' }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold leading-snug truncate">
                      {activeToast.title}
                    </p>
                    <p
                      className={`mt-0.5 text-[11px] leading-snug line-clamp-2 ${
                        isIncognito ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {activeToast.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Title Menu Overlay */}
            {gameState === 'TITLE_MENU' && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-4 sm:pt-10 px-3.5 sm:px-5 text-center">
                <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-slate-200/85 bg-white/88 backdrop-blur-sm px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
                  <button
                    type="button"
                    onClick={handleOpenMascotPopup}
                    className="mx-auto inline-flex items-center gap-2 rounded-xl px-2.5 py-1 hover:bg-slate-100/80 transition-colors cursor-pointer"
                  >
                    <GdgocMascotSticker className="h-9 w-9 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-blue-600">
                      {language === 'vi'
                        ? 'GDGoC DUT × Đà Nẵng Landmarks'
                        : 'GDGoC DUT × Da Nang Landmarks'}
                    </span>
                  </button>
                  <h1 className="mt-1 font-display text-2xl sm:text-5xl font-extrabold tracking-tight text-slate-900 text-balance">
                    StackLab Đà Nẵng
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                    {language === 'vi'
                      ? 'Chạm màn hình để nhảy tháp cùng rồng vàng 3D GDGoC DUT, nghe âm thanh nhảy bậc vui tai và chạm sticker để xem chi tiết!'
                      : 'Tap to stack and hop upward with the 3D GDGoC DUT golden dragon mascot, enjoy bouncy jump SFX, and tap stickers to inspect!'}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={startNewGame}
                      className="min-h-[44px] rounded-xl bg-blue-600 px-5 sm:px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      {language === 'vi' ? 'Bắt đầu xây tháp' : 'Start Building'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAtlasOpen(true)}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {language === 'vi' ? '7 Biểu tượng ĐN' : '7 Da Nang Stickers'}
                    </button>
                  </div>

                  <p className="mt-2.5 text-[11px] sm:text-xs text-slate-500 font-mono-tabular">
                    {language === 'vi'
                      ? `Kỷ lục: ${bestScore} · Chạm màn hình hoặc nhấn Space`
                      : `Highest score: ${bestScore} · Tap or press Spacebar`}
                  </p>
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameState === 'GAME_OVER' && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-4 sm:pt-10 px-3.5 sm:px-5 pb-3 text-center overflow-y-auto">
                <div className="pointer-events-auto max-w-sm w-full rounded-2xl border border-slate-200/85 bg-white/90 backdrop-blur-sm px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
                  <div className="font-display tabular-nums text-5xl sm:text-7xl font-bold tracking-tight text-slate-900 leading-none">
                    {score}
                  </div>
                  <h2 className="mt-1 font-display text-xl sm:text-3xl font-bold text-slate-900">
                    Game Over
                  </h2>
                  <p className="mt-1 text-xs sm:text-base font-medium text-slate-700 font-mono-tabular">
                    {language === 'vi'
                      ? `Điểm cao nhất: ${bestScore}`
                      : `Highest score: ${bestScore}`}
                  </p>

                  <div className="mt-1.5 flex items-center justify-center gap-2 text-xs text-slate-500 font-mono-tabular">
                    <span>
                      {language === 'vi'
                        ? `${approxMeters}m (${floor} tầng)`
                        : `${approxMeters}m (${floor} floors)`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Max {maxComboRun}x</span>
                    <span aria-hidden="true">·</span>
                    <span>{perfectCountRun} Perfect</span>
                  </div>

                  {currentLandmark && (
                    <button
                      type="button"
                      onClick={() => handleOpenLandmarkPopup(currentLandmark)}
                      className="mt-3 w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-left hover:bg-slate-100/80 transition-colors cursor-pointer"
                    >
                      <DaNangLandmarkModel
                        id={currentLandmark.id}
                        className="h-12 w-14 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <Award
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: currentLandmark.accentHex }}
                          />
                          <span className="truncate">
                            {language === 'vi' ? currentLandmark.nameVi : currentLandmark.nameEn}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {language === 'vi'
                            ? 'Chạm để xem chi tiết địa danh'
                            : 'Tap to view landmark details'}
                        </p>
                      </div>
                    </button>
                  )}

                  <div className="mt-3.5 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={startNewGame}
                      className="min-h-[44px] flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      {language === 'vi' ? 'Chơi lại ngay' : 'Play Again'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAtlasOpen(true)}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {language === 'vi' ? 'Xem địa danh' : 'Landmarks'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Thumb-Zone Bottom Bar (< 1024px) — Compact & Ergonomic 44px+ Hitboxes */}
          <div
            className={`lg:hidden shrink-0 mt-1.5 grid grid-cols-3 gap-1.5 rounded-2xl border p-1.5 transition-colors ${
              isIncognito
                ? 'border-slate-800 bg-[#181A20]'
                : 'border-slate-200 bg-white'
            }`}
          >
            <button
              type="button"
              onClick={armDidYouMean}
              disabled={gameState !== 'PLAYING' || (didYouMeanCharges <= 0 && !didYouMeanArmed)}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors ${
                didYouMeanArmed
                  ? 'bg-blue-600 text-white'
                  : isIncognito
                    ? 'bg-slate-800 text-slate-200 disabled:opacity-40'
                    : 'bg-slate-100 text-slate-800 disabled:opacity-40'
              }`}
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {didYouMeanArmed ? 'Perfect!' : `Auto x${didYouMeanCharges}`}
              </span>
            </button>

            <button
              type="button"
              onClick={activateIncognito}
              disabled={gameState !== 'PLAYING' || isIncognito || incognitoCharges <= 0}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors ${
                isIncognito
                  ? 'bg-sky-500 text-slate-950'
                  : isIncognito
                    ? 'bg-slate-800 text-slate-200 disabled:opacity-40'
                    : 'bg-slate-100 text-slate-800 disabled:opacity-40'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {isIncognito ? `2x (${incognitoBlocksLeft})` : `Ẩn danh x${incognitoCharges}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (nextLandmark) handleOpenLandmarkPopup(nextLandmark);
                else setAtlasOpen(true);
              }}
              className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors ${
                isIncognito
                  ? 'bg-slate-800 text-sky-400'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              <Map className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-mono-tabular">
                {nextLandmark
                  ? `F${nextLandmark.floor} · ${nextLandmark.altitudeMeters}m`
                  : `${unlockedLandmarkIds.length}/7`}
              </span>
            </button>
          </div>

          {/* Desktop Right Studio Rail (>= 1024px) */}
          <aside className="hidden lg:flex lg:col-span-4 flex-col gap-4">
            {/* 1. Da Nang Landmarks Tracker */}
            <section
              className={`rounded-xl border p-4 transition-colors ${
                isIncognito
                  ? 'border-slate-700/80 bg-[#20232A] text-slate-100'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className={`h-4 w-4 ${isIncognito ? 'text-sky-400' : 'text-blue-600'}`} />
                  <h2 className="font-display text-sm font-semibold">
                    {language === 'vi' ? 'Độ cao & Biểu tượng Đà Nẵng' : 'Da Nang Altitude Signatures'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAtlasOpen(true)}
                  className={`text-xs font-medium hover:underline underline-offset-4 ${
                    isIncognito ? 'text-sky-400' : 'text-blue-600'
                  }`}
                >
                  {unlockedLandmarkIds.length}/{DANANG_LANDMARKS.length}{' '}
                  {language === 'vi' ? 'mở khóa' : 'unlocked'}
                </button>
              </div>

              <div
                className={`mt-3 grid grid-cols-2 gap-1 rounded-lg p-1 ${
                  isIncognito ? 'bg-slate-900/70' : 'bg-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setGameMode('DANANG')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    gameMode === 'DANANG'
                      ? isIncognito
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isIncognito
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'vi' ? 'Đà Nẵng Landmarks' : 'Da Nang Landmarks'}
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('CLASSIC')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    gameMode === 'CLASSIC'
                      ? isIncognito
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isIncognito
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {language === 'vi' ? 'Cổ điển (Endless)' : 'Classic Endless'}
                </button>
              </div>

              {gameMode === 'DANANG' ? (
                <div className="mt-3.5">
                  {nextLandmark ? (
                    <button
                      type="button"
                      onClick={() => handleOpenLandmarkPopup(nextLandmark)}
                      className={`w-full flex items-center gap-3 rounded-xl p-2 -mx-2 text-left transition-colors cursor-pointer ${
                        isIncognito ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <DaNangLandmarkModel
                        id={nextLandmark.id}
                        className="h-14 w-18 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={isIncognito ? 'text-slate-400' : 'text-slate-500'}>
                            {language === 'vi' ? 'Mốc tiếp theo (bấm xem)' : 'Next (tap to view)'}
                          </span>
                          <span className="font-mono-tabular font-semibold">
                            F{nextLandmark.floor} · {nextLandmark.altitudeMeters}m
                          </span>
                        </div>
                        <p className="mt-0.5 font-display text-sm font-bold truncate">
                          {language === 'vi' ? nextLandmark.nameVi : nextLandmark.nameEn}
                        </p>
                        <div
                          className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                            isIncognito ? 'bg-slate-800' : 'bg-slate-100'
                          }`}
                        >
                          <div
                            className="h-full transition-all duration-200"
                            style={{
                              width: `${altitudeProgress}%`,
                              backgroundColor: nextLandmark.accentHex,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="mt-1 text-xs leading-relaxed">
                      <p className="font-display text-sm font-bold text-emerald-500">
                        {language === 'vi'
                          ? 'Đã chinh phục toàn bộ 7 biểu tượng Đà Nẵng!'
                          : 'All 7 Da Nang Signatures Conquered!'}
                      </p>
                      <p className={isIncognito ? 'text-slate-400 mt-1' : 'text-slate-500 mt-1'}>
                        {language === 'vi'
                          ? 'Tháp của bạn đang vươn cao trên tầng mây 200m+ vịnh Đà Nẵng.'
                          : 'Your tower now rises above the 200m+ cloud horizon over Da Nang Bay.'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p
                  className={`mt-3 text-xs leading-relaxed ${
                    isIncognito ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {language === 'vi'
                    ? 'Chế độ tối giản tập trung hoàn toàn vào phản xạ thả khối và chuỗi âm thanh Perfect.'
                    : 'Minimalist focus mode with pure block timing and Perfect combo chimes.'}
                </p>
              )}
            </section>

            {/* 2. Google Easter Eggs Power-Ups */}
            <section
              className={`rounded-xl border p-4 transition-colors ${
                isIncognito
                  ? 'border-slate-700/80 bg-[#20232A] text-slate-100'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className={`h-4 w-4 ${isIncognito ? 'text-sky-400' : 'text-blue-600'}`} />
                  <h2 className="font-display text-sm font-semibold">
                    Google Easter Eggs
                  </h2>
                </div>
                <span
                  className={`text-xs font-mono-tabular ${
                    isIncognito ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {language === 'vi' ? 'Phím Q / E' : 'Keys Q / E'}
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <button
                  type="button"
                  onClick={armDidYouMean}
                  disabled={gameState !== 'PLAYING' || (didYouMeanCharges <= 0 && !didYouMeanArmed)}
                  className={`w-full min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    didYouMeanArmed
                      ? 'border-blue-500 bg-blue-50/90 text-slate-900 dark:bg-blue-950/60 dark:text-white'
                      : isIncognito
                        ? 'border-slate-700 bg-slate-800/60 hover:bg-slate-800 disabled:opacity-45'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 disabled:opacity-45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Search className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="text-xs font-medium truncate">
                        <span className="text-rose-500">Did you mean:</span>{' '}
                        <span className="italic font-bold text-blue-600 underline">Perfect?</span>
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold shrink-0">
                      {didYouMeanArmed
                        ? language === 'vi'
                          ? 'Đang bật'
                          : 'Armed'
                        : `x${didYouMeanCharges}`}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      didYouMeanArmed
                        ? 'text-blue-800 dark:text-sky-200'
                        : isIncognito
                          ? 'text-slate-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {language === 'vi'
                      ? 'Tự căn thẳng cú thả kế tiếp thành Perfect & phục hồi độ rộng.'
                      : 'Auto-snaps next drop to Perfect & widens block.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={activateIncognito}
                  disabled={gameState !== 'PLAYING' || isIncognito || incognitoCharges <= 0}
                  className={`w-full min-h-[44px] rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                    isIncognito
                      ? 'border-sky-500 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-900 disabled:opacity-45'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <EyeOff
                        className={`h-4 w-4 shrink-0 ${
                          isIncognito ? 'text-sky-400' : 'text-slate-700'
                        }`}
                      />
                      <span className="font-display text-xs font-bold truncate">
                        Incognito Mode (2x Score)
                      </span>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold shrink-0">
                      {isIncognito ? `${incognitoBlocksLeft} blocks` : `x${incognitoCharges}`}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      isIncognito ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {language === 'vi'
                      ? 'Nền tối 6 tầng: chậm -35%, vùng Perfect +55%, nhân đôi điểm.'
                      : 'Dark mode for 6 blocks: -35% speed, +55% Perfect zone, 2x score.'}
                  </p>
                </button>
              </div>
            </section>

            {/* 3. Sound Effects Studio Card (No background music) */}
            <MusicLabPanel
              language={language}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              scale={scale}
              onChangeScale={handleChangeScale}
              comboStreak={comboStreak}
              lastNoteName={lastNoteName}
              isIncognito={isIncognito}
            />
          </aside>
        </div>
      </main>

      {/* Da Nang Landmark Atlas Modal */}
      <LandmarkAtlasModal
        isOpen={atlasOpen}
        onClose={() => setAtlasOpen(false)}
        unlockedIds={unlockedLandmarkIds}
        highestFloor={bestScore}
        language={language}
        isIncognito={isIncognito}
        onSelectLandmark={(lm) => {
          setAtlasOpen(false);
          handleOpenLandmarkPopup(lm);
        }}
      />

      {/* Tap-to-Inspect Da Nang Sticker Detail Popup */}
      <LandmarkDetailModal
        landmark={inspectedLandmark}
        onClose={() => setInspectedLandmark(null)}
        onOpenAtlas={() => {
          setInspectedLandmark(null);
          setAtlasOpen(true);
        }}
        isUnlocked={
          inspectedLandmark ? unlockedLandmarkIds.includes(inspectedLandmark.id) : false
        }
        language={language}
        isIncognito={isIncognito}
      />

      {/* GDGoC DUT Chibi Mascot Detail Popup */}
      <MascotDetailModal
        isOpen={mascotOpen}
        onClose={() => setMascotOpen(false)}
        language={language}
        isIncognito={isIncognito}
      />

      {/* Scoring & Controls Modal */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
          onClick={() => setGuideOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border p-6 shadow-xl ${
              isIncognito
                ? 'border-slate-700 bg-[#20232A] text-slate-100'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 id="guide-modal-title" className="font-display text-lg font-bold">
                {language === 'vi' ? 'Tính điểm & Hiệu ứng âm thanh' : 'Scoring & Sound FX'}
              </h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl ${
                  isIncognito ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
                aria-label="Close guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm leading-relaxed">
              <div>
                <h3 className="font-display font-semibold">
                  {language === 'vi' ? '01. Hiệu ứng âm thanh theo combo' : '01. Tactile Sound Effects'}
                </h3>
                <p className={isIncognito ? 'text-slate-300 mt-1' : 'text-slate-600 mt-1'}>
                  {language === 'vi'
                    ? 'Không phát nhạc nền gây rối. Mỗi lần thả thường tạo tiếng gõ & cắt khối dứt khoát (+1 điểm), còn thả Perfect sẽ vang tiếng chuông leo nốt nhạc từ +3 đến +6 điểm.'
                    : 'Pure gameplay SFX with zero background music. Normal drops give crisp slice feedback (+1 pt), while Perfect drops chime up a musical scale for +3 to +6 pts.'}
                </p>
              </div>

              <div>
                <h3 className="font-display font-semibold">
                  {language === 'vi' ? '02. Chạm Sticker để xem thông tin' : '02. Tap Stickers to Inspect'}
                </h3>
                <p className={isIncognito ? 'text-slate-300 mt-1' : 'text-slate-600 mt-1'}>
                  {language === 'vi'
                    ? 'Khi chơi trên điện thoại hoặc máy tính, bạn có thể chạm trực tiếp vào bất kỳ sticker Đà Nẵng nào trên màn hình để bật popup xem thông tin địa danh.'
                    : 'Tap directly on any Da Nang sticker on the skyline to open its info card and pause cleanly while reading.'}
                </p>
              </div>

              <div
                className={`rounded-xl border p-3.5 text-xs font-mono-tabular space-y-1.5 ${
                  isIncognito ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex justify-between">
                  <span>Tap / Space / Enter</span>
                  <span>{language === 'vi' ? 'Thả khối' : 'Drop block'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Q</span>
                  <span>Did you mean: Perfect?</span>
                </div>
                <div className="flex justify-between">
                  <span>E</span>
                  <span>Incognito Mode (2x Score)</span>
                </div>
                <div className="flex justify-between">
                  <span>M</span>
                  <span>{language === 'vi' ? 'Tắt / Bật SFX' : 'Mute / Unmute SFX'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  X,
  Check,
  Download,
  FileText,
  Settings,
  PlayCircle,
  Loader2,
  Video,
  Key,
  AlertCircle,
  Play,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { GoogleGenAI } from "@google/genai";

type AvatarIdentity = {
  avatar_id: string;
  origin: string;
  face_shape: string;
  skin_tone: string;
  hair: string;
  gender_expression: string;
  age_range: string;
  facial_proportions: string;
  eye_shape: string;
  camera_framing: string;
  lighting_reference: string;
  identity_lock: boolean;
};

type Scene = { scene_id: number; scene_text: string };

type AnimationMetadata = {
  facial_expression: string;
  eye_behavior: string;
  head_movement: string;
  gesture: string;
  breathing: string;
  pause_before: string;
  pause_after: string;
  emotion_intensity: number;
};

type GeneratedScene = { scene: Scene; animation: AnimationMetadata };

type ApiKey = {
  id: string;
  name: string;
  provider: string;
  key: string;
  enabled: boolean;
};
type RenderJob = {
  status: "pending" | "rendering" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  error?: string;
};

export default function App() {
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [avatarIdentity, setAvatarIdentity] = useState<AvatarIdentity | null>(
    null,
  );

  const [presentationStyle, setPresentationStyle] = useState("Tech Educator");
  const [gestureIntensity, setGestureIntensity] = useState(50);
  const [headMovement, setHeadMovement] = useState(50);
  const [expressionRange, setExpressionRange] = useState(50);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [emotionalTone, setEmotionalTone] = useState("confident");

  const [script, setScript] = useState("");
  const [isProcessingScript, setIsProcessingScript] = useState(false);
  const [scenes, setScenes] = useState<GeneratedScene[]>([]);

  const [targetModel, setTargetModel] = useState<"veo-3.1" | "sora-2">(
    "veo-3.1",
  );

  // Render Engine State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState({
    provider: "Official",
    name: "",
    key: "",
  });
  const [renderModel, setRenderModel] = useState("veo-3.1");
  const [renderProvider, setRenderProvider] = useState("Official");
  const [autoMerge, setAutoMerge] = useState(false);
  const [renderJobs, setRenderJobs] = useState<Record<number, RenderJob>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (images.length + files.length > 3)
      return alert("Maximum 3 images allowed");

    Array.from(files as FileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result)
          setImages((prev) => [...prev, e.target!.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const analyzeAvatar = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is missing. Please configure it in the AI Studio Secrets panel.",
        );
      }
      const ai = new GoogleGenAI({ apiKey });
      const parts = images.map((img) => ({
        inlineData: {
          data: img.split(",")[1],
          mimeType: img.split(";")[0].split(":")[1],
        },
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: {
          parts: [
            ...parts,
            {
              text: "Analyze these images and extract a Persistent Avatar Identity Profile. Return JSON.",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              face_shape: { type: "STRING" },
              skin_tone: { type: "STRING" },
              hair: { type: "STRING" },
              gender_expression: { type: "STRING" },
              age_range: { type: "STRING" },
              facial_proportions: { type: "STRING" },
              eye_shape: { type: "STRING" },
              camera_framing: { type: "STRING" },
              lighting_reference: { type: "STRING" },
            },
            required: [
              "face_shape",
              "skin_tone",
              "hair",
              "gender_expression",
              "age_range",
              "facial_proportions",
              "eye_shape",
              "camera_framing",
              "lighting_reference",
            ],
          },
        },
      });

      let jsonText = response.text || "{}";
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(json)?\n/, "").replace(/\n```$/, "");
      }
      const data = JSON.parse(jsonText);
      setAvatarIdentity({
        ...data,
        avatar_id: `LOCKED_AVATAR_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        origin: "user_uploaded_image",
        identity_lock: true,
      });
      setStep(2);
    } catch (error) {
      console.error("Avatar analysis error:", error);
      alert(
        `Failed to analyze avatar: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processScript = async () => {
    if (!script.trim()) return;
    setIsProcessingScript(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is missing. Please configure it in the AI Studio Secrets panel.",
        );
      }
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Split script into short talking scenes (6-9s, 20-28 words). Generate animation metadata.
        Style: ${presentationStyle}, Gesture: ${gestureIntensity}%, Head: ${headMovement}%, Emotion: ${emotionalTone}
        Script: ${script}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                scene: {
                  type: "OBJECT",
                  properties: {
                    scene_id: { type: "INTEGER" },
                    scene_text: { type: "STRING" },
                  },
                  required: ["scene_id", "scene_text"],
                },
                animation: {
                  type: "OBJECT",
                  properties: {
                    facial_expression: { type: "STRING" },
                    eye_behavior: { type: "STRING" },
                    head_movement: { type: "STRING" },
                    gesture: { type: "STRING" },
                    breathing: { type: "STRING" },
                    pause_before: { type: "STRING" },
                    pause_after: { type: "STRING" },
                    emotion_intensity: { type: "NUMBER" },
                  },
                  required: [
                    "facial_expression",
                    "eye_behavior",
                    "head_movement",
                    "gesture",
                    "breathing",
                    "pause_before",
                    "pause_after",
                    "emotion_intensity",
                  ],
                },
              },
              required: ["scene", "animation"],
            },
          },
        },
      });

      let jsonText = response.text || "[]";
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(json)?\n/, "").replace(/\n```$/, "");
      }
      setScenes(JSON.parse(jsonText));
      setStep(3);
    } catch (error) {
      console.error("Script processing error:", error);
      alert(
        `Failed to process script: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsProcessingScript(false);
    }
  };

  const generateVeoPrompt = (scene: GeneratedScene) =>
    JSON.stringify(
      {
        model: "veo-3.1",
        aspect_ratio: "9:16",
        avatar_identity: avatarIdentity,
        scene_text: scene.scene.scene_text,
        animation: scene.animation,
        visual_style: {
          realism: "ultra-realistic",
          lighting: "soft studio",
          camera: "stable chest-up",
          background: "clean neutral",
        },
      },
      null,
      2,
    );

  const generateSoraPrompt = (
    scene: GeneratedScene,
  ) => `Create a vertical 9:16 ultra-realistic talking avatar video.
Avatar identity: ${JSON.stringify(avatarIdentity, null, 2)}
Speech text: "${scene.scene.scene_text}"
Behavior: ${scene.animation.eye_behavior}, ${scene.animation.head_movement}, ${scene.animation.gesture}, ${scene.animation.facial_expression}
Style: cinematic realism, studio lighting, stable chest-up framing.
IMPORTANT: The avatar must remain visually identical across all scenes.`;

  const downloadPrompt = (scene: GeneratedScene) => {
    const content =
      targetModel === "veo-3.1"
        ? generateVeoPrompt(scene)
        : generateSoraPrompt(scene);
    saveAs(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
      `scene_${scene.scene.scene_id}_prompt.${targetModel === "veo-3.1" ? "json" : "txt"}`,
    );
  };

  const downloadAllPrompts = async () => {
    const zip = new JSZip();
    scenes.forEach((scene) => {
      const content =
        targetModel === "veo-3.1"
          ? generateVeoPrompt(scene)
          : generateSoraPrompt(scene);
      zip.file(
        `scene_${scene.scene.scene_id}_prompt.${targetModel === "veo-3.1" ? "json" : "txt"}`,
        content,
      );
    });
    saveAs(
      (await zip.generateAsync({ type: "blob" })) as Blob,
      `avatar_prompts_${targetModel}.zip`,
    );
  };

  // Render Engine Logic
  const addApiKey = () => {
    if (!newKey.key || !newKey.name) return;
    setApiKeys([
      ...apiKeys,
      { ...newKey, id: Date.now().toString(), enabled: true },
    ]);
    setNewKey({ provider: "Official", name: "", key: "" });
  };

  const toggleApiKey = (id: string) => {
    setApiKeys(
      apiKeys.map((k) => (k.id === id ? { ...k, enabled: !k.enabled } : k)),
    );
  };

  const removeApiKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  const renderSceneVideo = async (scene: GeneratedScene) => {
    if (!avatarIdentity || images.length === 0)
      return alert("Avatar identity missing. Blocked.");

    const activeKey = apiKeys.find(
      (k) => k.provider === renderProvider && k.enabled,
    );
    if (!activeKey) return alert(`No active API key for ${renderProvider}`);

    setRenderJobs((prev) => ({
      ...prev,
      [scene.scene.scene_id]: { status: "rendering", progress: 10 },
    }));

    try {
      let videoUrl = "";

      if (renderProvider === "Official" && renderModel === "veo-3.1") {
        const customAi = new GoogleGenAI({ apiKey: activeKey.key });
        let operation = await customAi.models.generateVideos({
          model: "veo-3.1-fast-generate-preview",
          prompt: `Avatar: ${JSON.stringify(avatarIdentity)}. Speech: ${scene.scene.scene_text}. Animation: ${JSON.stringify(scene.animation)}`,
          image: {
            imageBytes: images[0].split(",")[1],
            mimeType: images[0].split(";")[0].split(":")[1],
          },
          config: {
            numberOfVideos: 1,
            resolution: "720p",
            aspectRatio: "9:16",
          },
        });

        while (!operation.done) {
          await new Promise((r) => setTimeout(r, 5000));
          operation = await customAi.operations.getVideosOperation({
            operation,
          });
          setRenderJobs((prev) => ({
            ...prev,
            [scene.scene.scene_id]: { status: "rendering", progress: 50 },
          }));
        }

        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
          const res = await fetch(uri, {
            headers: { "x-goog-api-key": activeKey.key },
          });
          videoUrl = URL.createObjectURL(await res.blob());
        } else throw new Error("No video URI returned");
      } else {
        // Mock adapter for third-party or Sora
        await new Promise((r) => setTimeout(r, 3000));
        setRenderJobs((prev) => ({
          ...prev,
          [scene.scene.scene_id]: { status: "rendering", progress: 60 },
        }));
        await new Promise((r) => setTimeout(r, 3000));
        videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; // Mock video for demonstration
      }

      setRenderJobs((prev) => ({
        ...prev,
        [scene.scene.scene_id]: {
          status: "completed",
          progress: 100,
          videoUrl,
        },
      }));
    } catch (error: any) {
      setRenderJobs((prev) => ({
        ...prev,
        [scene.scene.scene_id]: {
          status: "failed",
          progress: 0,
          error: error.message,
        },
      }));
    }
  };

  const renderAllScenes = async () => {
    for (const scene of scenes) {
      await renderSceneVideo(scene);
    }
  };

  const downloadAllClips = async () => {
    const zip = new JSZip();
    let hasClips = false;
    for (const [id, job] of Object.entries(renderJobs) as [
      string,
      RenderJob,
    ][]) {
      if (job.status === "completed" && job.videoUrl) {
        hasClips = true;
        const res = await fetch(job.videoUrl);
        zip.file(`scene_${id}.mp4`, await res.blob());
      }
    }
    if (!hasClips) return alert("No completed clips to download.");
    saveAs(
      (await zip.generateAsync({ type: "blob" })) as Blob,
      `rendered_scenes.zip`,
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-zinc-800 bg-[#0f0f0f] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold">
              PF
            </div>
            <h1 className="text-lg font-medium text-white tracking-tight">
              Prompt Factory
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-12 gap-12">
          {/* Sidebar */}
          <div className="col-span-3 space-y-8">
            <div className="space-y-4">
              <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                Workflow
              </h3>
              <div className="space-y-2">
                {[
                  { id: 1, name: "Identity Lock", icon: ImageIcon },
                  { id: 2, name: "Script & Style", icon: FileText },
                  { id: 3, name: "Export Prompts", icon: Download },
                  { id: 4, name: "Render Engine", icon: Video },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      s.id <= Math.max(step, scenes.length > 0 ? 4 : step)
                        ? setStep(s.id)
                        : null
                    }
                    disabled={
                      s.id > Math.max(step, scenes.length > 0 ? 4 : step)
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                      step === s.id
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : s.id < step || (scenes.length > 0 && s.id === 4)
                          ? "text-zinc-400 hover:bg-zinc-800/50 cursor-pointer"
                          : "text-zinc-600 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <s.icon className="w-4 h-4" />
                    <span className="font-medium">{s.name}</span>
                    {(s.id < step || (s.id === 3 && scenes.length > 0)) && (
                      <Check className="w-4 h-4 ml-auto text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {avatarIdentity && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
                  <Check className="w-3 h-3" /> IDENTITY LOCKED
                </div>
                <div className="text-xs space-y-1 text-zinc-400">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">ID:</span>{" "}
                    <span className="font-mono">
                      {String(avatarIdentity.avatar_id).split("_")[2]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shape:</span>{" "}
                    <span>{String(avatarIdentity.face_shape)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {/* STEP 1: IDENTITY */}
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-2xl font-medium text-white mb-2">
                    Avatar Identity Lock
                  </h2>
                  <p className="text-zinc-400">
                    Upload 1-3 clear reference images.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-zinc-800 group"
                    >
                      <img
                        src={img}
                        alt={`Ref ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() =>
                          setImages(images.filter((_, idx) => idx !== i))
                        }
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-[3/4] rounded-2xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 flex flex-col items-center justify-center gap-3 text-zinc-500 hover:text-indigo-400"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-sm font-medium">Add Image</span>
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <div className="flex justify-end">
                  <button
                    onClick={analyzeAvatar}
                    disabled={images.length === 0 || isAnalyzing}
                    className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Lock Identity <Check className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SCRIPT & STYLE */}
            {step === 2 && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-2xl font-medium text-white mb-2">
                    Script & Style
                  </h2>
                  <p className="text-zinc-400">
                    Define presentation style and paste script.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <Settings className="w-4 h-4 text-zinc-500" />{" "}
                        Presentation Style
                      </label>
                      <select
                        value={presentationStyle}
                        onChange={(e) => setPresentationStyle(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {[
                          "Tech Educator",
                          "Business Coach",
                          "Lifestyle Creator",
                          "Motivational Speaker",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-white">
                        Behavior Controls
                      </label>
                      <div className="space-y-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                        {[
                          {
                            label: "Gesture Intensity",
                            value: gestureIntensity,
                            set: setGestureIntensity,
                          },
                          {
                            label: "Head Movement",
                            value: headMovement,
                            set: setHeadMovement,
                          },
                        ].map((ctrl) => (
                          <div key={ctrl.label} className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-zinc-400">
                                {ctrl.label}
                              </span>
                              <span className="text-zinc-500">
                                {ctrl.value}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={ctrl.value}
                              onChange={(e) =>
                                ctrl.set(parseInt(e.target.value))
                              }
                              className="w-full accent-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-zinc-500" /> Script
                        Content
                      </label>
                      <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Paste your full script here..."
                        className="w-full h-[300px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-zinc-800">
                  <button
                    onClick={processScript}
                    disabled={!script.trim() || isProcessingScript}
                    className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessingScript ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        Processing...
                      </>
                    ) : (
                      <>
                        Generate Scenes <PlayCircle className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: EXPORT */}
            {step === 3 && (
              <div className="space-y-8 animate-in fade-in">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-medium text-white mb-2">
                      Export Prompts
                    </h2>
                    <p className="text-zinc-400">
                      Generated {scenes.length} scenes.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                      <button
                        onClick={() => setTargetModel("veo-3.1")}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${targetModel === "veo-3.1" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
                      >
                        Veo 3.1
                      </button>
                      <button
                        onClick={() => setTargetModel("sora-2")}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${targetModel === "sora-2" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}
                      >
                        Sora 2
                      </button>
                    </div>
                    <button
                      onClick={downloadAllPrompts}
                      className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 flex items-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" /> Download All
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 flex items-center gap-2 text-sm"
                    >
                      Continue to Render <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  {scenes.map((scene, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-400">
                            {scene.scene.scene_id}
                          </span>
                          <span className="text-sm font-medium text-zinc-300">
                            Scene {scene.scene.scene_id}
                          </span>
                        </div>
                        <button
                          onClick={() => downloadPrompt(scene)}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-md"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-zinc-300">
                            "{scene.scene.scene_text}"
                          </p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3 space-y-2">
                          <div className="text-xs font-mono text-zinc-500 mb-2">
                            ANIMATION METADATA
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div className="text-zinc-400">
                              Expression:{" "}
                              <span className="text-zinc-300">
                                {String(scene.animation.facial_expression)}
                              </span>
                            </div>
                            <div className="text-zinc-400">
                              Gesture:{" "}
                              <span className="text-zinc-300">
                                {String(scene.animation.gesture)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: RENDER ENGINE */}
            {step === 4 && (
              <div className="space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-2xl font-medium text-white mb-2">
                    Render Engine
                  </h2>
                  <p className="text-zinc-400">
                    Connect to models and render your scenes directly.
                  </p>
                </div>

                {/* API Keys */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Key className="w-5 h-5 text-indigo-400" /> API Key
                    Management
                  </div>

                  <div className="flex gap-4">
                    <select
                      value={newKey.provider}
                      onChange={(e) =>
                        setNewKey({ ...newKey, provider: e.target.value })
                      }
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="Official">Official API</option>
                      <option value="fal.ai">fal.ai</option>
                      <option value="kie.ai">kie.ai</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Key Name (e.g. My Veo Key)"
                      value={newKey.name}
                      onChange={(e) =>
                        setNewKey({ ...newKey, name: e.target.value })
                      }
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white flex-1"
                    />
                    <input
                      type="password"
                      placeholder="API Key"
                      value={newKey.key}
                      onChange={(e) =>
                        setNewKey({ ...newKey, key: e.target.value })
                      }
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white flex-1"
                    />
                    <button
                      onClick={addApiKey}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium"
                    >
                      Add Key
                    </button>
                  </div>

                  {apiKeys.length > 0 && (
                    <div className="space-y-2">
                      {apiKeys.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800/50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={k.enabled}
                              onChange={() => toggleApiKey(k.id)}
                              className="accent-indigo-500"
                            />
                            <span className="text-sm font-medium text-white">
                              {k.name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {k.provider}
                            </span>
                          </div>
                          <button
                            onClick={() => removeApiKey(k.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Render Settings */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Model</label>
                    <select
                      value={renderModel}
                      onChange={(e) => setRenderModel(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="veo-3.1">Google Veo 3.1</option>
                      <option value="sora-2">Sora 2</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-zinc-400">Provider</label>
                    <select
                      value={renderProvider}
                      onChange={(e) => setRenderProvider(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="Official">Official API</option>
                      <option value="fal.ai">fal.ai</option>
                      <option value="kie.ai">kie.ai</option>
                    </select>
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                      <input
                        type="checkbox"
                        checked={autoMerge}
                        onChange={(e) => setAutoMerge(e.target.checked)}
                        className="accent-indigo-500"
                      />
                      Auto-merge scenes (MP4)
                    </label>
                  </div>
                </div>

                {/* Render Dashboard */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">
                      Scene Dashboard
                    </h3>
                    <div className="flex gap-3">
                      <button
                        onClick={downloadAllClips}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download Clips
                      </button>
                      <button
                        onClick={renderAllScenes}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Render All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {scenes.map((scene) => {
                      const job = renderJobs[scene.scene.scene_id] || {
                        status: "pending",
                        progress: 0,
                      };
                      return (
                        <div
                          key={scene.scene.scene_id}
                          className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex items-center gap-4"
                        >
                          <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-400 shrink-0">
                            {scene.scene.scene_id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-zinc-300 truncate">
                              "{scene.scene.scene_text}"
                            </div>
                            {job.status === "rendering" && (
                              <div className="mt-2 h-1 bg-zinc-800 rounded overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500 transition-all duration-500"
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                            )}
                            {job.status === "failed" && (
                              <div className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {job.error}
                              </div>
                            )}
                          </div>

                          {job.status === "completed" && job.videoUrl && (
                            <div className="shrink-0 h-16 w-28 bg-black rounded overflow-hidden">
                              <video
                                src={job.videoUrl}
                                controls
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          <button
                            onClick={() => renderSceneVideo(scene)}
                            disabled={job.status === "rendering"}
                            className="shrink-0 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium min-w-[100px]"
                          >
                            {job.status === "rendering"
                              ? "Rendering..."
                              : job.status === "failed"
                                ? "Retry"
                                : job.status === "completed"
                                  ? "Re-render"
                                  : "Render"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

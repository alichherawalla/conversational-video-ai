import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Plus, User } from "lucide-react";
import RecordingStudio from "@/components/recording-studio";
import QuestionBank from "@/components/question-bank";
import ContentGeneration from "@/components/content-generation";
import VideoLibrary from "@/components/video-library";

type Tab = "recording" | "questions" | "content" | "library";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("recording");

  const tabs = [
    { id: "recording" as Tab, label: "Recording Studio", icon: Video },
    { id: "questions" as Tab, label: "Question Bank", icon: "question-circle" },
    { id: "content" as Tab, label: "Content Generation", icon: "share-alt" },
    { id: "library" as Tab, label: "Video Library", icon: "folder" },
  ] as const;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <Video className="text-white" size={16} />
                </div>
                <h1 className="text-xl font-bold text-neutral-800">
                  VideoAI Pro
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button className="bg-primary text-white hover:bg-primary/90">
                <Plus className="mr-2" size={16} />
                New Session
              </Button>
              <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center">
                <User className="text-neutral-600" size={16} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8 border-b border-neutral-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab.id === "recording" && (
                  <Video className="mr-2 inline" size={16} />
                )}
                {tab.id === "questions" && (
                  <i className="fas fa-question-circle mr-2"></i>
                )}
                {tab.id === "content" && (
                  <i className="fas fa-share-alt mr-2"></i>
                )}
                {tab.id === "library" && <i className="fas fa-folder mr-2"></i>}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "recording" && <RecordingStudio />}
        {activeTab === "questions" && <QuestionBank />}
        {activeTab === "content" && <ContentGeneration />}
        {activeTab === "library" && <VideoLibrary />}
      </main>
    </div>
  );
}

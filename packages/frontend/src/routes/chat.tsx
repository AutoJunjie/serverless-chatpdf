import React, { useState, useEffect, KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "aws-amplify";
import { Conversation } from "../common/types";
import ChatSidebar from "../components/ChatSidebar";
import ChatMessages from "../components/ChatMessages";
import LoadingGrid from "../../public/loading-grid.svg";

// Core viewer
import { Worker, Viewer } from '@react-pdf-viewer/core';

// Plugins
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

const Document: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = React.useState<string>("idle");
  const [messageStatus, setMessageStatus] = useState<string>("idle");
  const [conversationListStatus, setConversationListStatus] = useState<
    "idle" | "loading"
  >("idle");
  const [prompt, setPrompt] = useState("");

  // Create new plugin instance
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const fetchData = async (conversationid = params.conversationid) => {
    setLoading("loading");
    const conversation = await API.get(
      "serverless-pdf-chat",
      `/doc/${params.documentid}/${conversationid}`,
      {}
    );
    setConversation(conversation);
    setLoading("idle");
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const addConversation = async () => {
    setConversationListStatus("loading");
    const newConversation = await API.post(
      "serverless-pdf-chat",
      `/doc/${params.documentid}`,
      {}
    );
    fetchData(newConversation.conversationid);
    navigate(`/doc/${params.documentid}/${newConversation.conversationid}`);
    setConversationListStatus("idle");
  };

  const switchConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
    const targetButton = e.target as HTMLButtonElement;
    navigate(`/doc/${params.documentid}/${targetButton.id}`);
    fetchData(targetButton.id);
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key == "Enter") {
      submitMessage();
    }
  };

  const submitMessage = async () => {
    setMessageStatus("loading");

    if (conversation !== null) {
      const previewMessage = {
        type: "text",
        data: {
          content: prompt,
          additional_kwargs: {},
          example: false,
        },
      };

      const updatedConversation = {
        ...conversation,
        messages: [...conversation.messages, previewMessage],
      };

      setConversation(updatedConversation);
    }

    await API.post(
      "serverless-pdf-chat",
      `/${conversation?.document.documentid}/${conversation?.conversationid}`,
      {
        body: {
          fileName: conversation?.document.filename,
          prompt: prompt,
        },
      }
    );
    setPrompt("");
    fetchData(conversation?.conversationid);
    setMessageStatus("idle");
  };

  return (
    <div className="flex flex-col h-screen">
      {loading === "loading" && !conversation && (
        <div className="flex flex-col items-center mt-6">
          <img src={LoadingGrid} width={40} />
        </div>
      )}
      {conversation && (
        <div className="flex flex-row h-full">
          <div className="w-64 border border-gray-200 rounded-lg">
            <ChatSidebar
              conversation={conversation}
              params={params}
              addConversation={addConversation}
              switchConversation={switchConversation}
              conversationListStatus={conversationListStatus}
            />
          </div>
          <div className="flex-1 p-4">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.js">
              <Viewer
                fileUrl='https://arxiv.org/pdf/1706.03762.pdf'
                plugins={[defaultLayoutPluginInstance]}
              />
            </Worker>
          </div>
          <div className="w-80 border border-gray-200 rounded-lg">
            <ChatMessages
              prompt={prompt}
              conversation={conversation}
              messageStatus={messageStatus}
              submitMessage={submitMessage}
              handleKeyPress={handleKeyPress}
              handlePromptChange={handlePromptChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Document;
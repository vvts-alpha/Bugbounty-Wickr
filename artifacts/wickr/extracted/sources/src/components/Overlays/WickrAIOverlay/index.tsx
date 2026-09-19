import SettingItem from '../SettingItem';
import { PanelOverlay, Toggle } from '@/componentlibrary';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { updateAutoSummaryEnabled, updateShowKnowledgeBaseOnlyChat } from '@/store/thunks/settings';

const WickrAIOverlay = () => {
  const dispatch = useAppDispatch();
  const autoSummaryEnabled = useSetting('autoSummaryEnabled');
  const showKnowledgeBaseOnlyChat = useSetting('showKnowledgeBaseOnlyChat');

  return (
    <PanelOverlay title="Wickr AI">
      <SettingItem
        title="Auto Summary"
        description="Automatically generate summaries of unread messages to help you catch up quickly on conversations."
      >
        <Toggle
          label="Auto Summary"
          onChange={() => dispatch(updateAutoSummaryEnabled(!autoSummaryEnabled))}
          checked={autoSummaryEnabled}
        />
      </SettingItem>
      <SettingItem
        title="Knowledge base only chat"
        description="Add a navrail option to chat with AI that can only use information from knowledge bases"
      >
        <Toggle
          label="Knowledge base only chat"
          onChange={() => dispatch(updateShowKnowledgeBaseOnlyChat(!showKnowledgeBaseOnlyChat))}
          checked={showKnowledgeBaseOnlyChat}
        />
      </SettingItem>
    </PanelOverlay>
  );
};

export default WickrAIOverlay;

// Full-page chat interface at /chat route

import { Grid, Column, Tile } from '@carbon/react';
import { ChatPanel } from '@/components/ai/ChatPanel';
import './ChatPage.scss';

export function ChatPage() {
  return (
    <Grid className="chat-page">
      <Column lg={16} md={8} sm={4}>
        <h2 className="chat-page__heading">Migration Assistant</h2>
        <p className="chat-page__description">
          Ask questions about your VMware environment, migration planning,
          IBM Cloud ROKS, VPC VSI options, or general cloud migration concepts.
        </p>
      </Column>

      <Column lg={12} md={8} sm={4} className="chat-page__main">
        <Tile className="chat-page__chat-container">
          <ChatPanel className="chat-page__panel" />
        </Tile>
      </Column>

      <Column lg={4} md={8} sm={4} className="chat-page__sidebar">
        <Tile className="chat-page__topics">
          <h4>Topics</h4>
          <ul>
            <li>Environment analysis</li>
            <li>ROKS migration planning</li>
            <li>VSI profile selection</li>
            <li>Wave planning strategy</li>
            <li>Cost optimization</li>
            <li>Risk assessment</li>
            <li>IBM Cloud concepts</li>
            <li>OpenShift Virtualization</li>
          </ul>
        </Tile>

        <Tile className="chat-page__privacy">
          <h4>Data Privacy</h4>
          <p>
            Only aggregated environment summaries are sent to the AI service.
            Individual VM names, IP addresses, and other identifying details
            are never transmitted.
          </p>
        </Tile>
      </Column>
    </Grid>
  );
}

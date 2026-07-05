import { IStreams } from './chat';

export interface IVrmConfig {
  offset?: number[];
  blendshapesUpperCase?: boolean;
  rotation?: number[];
  expressionWeights?: { [key: string]: number };
  creator?: string;
}

export interface ICustomVRM {
  id: number;
  userId: number;
  vrmId: number;
  vrm: IVrmProps;
  createdAt: Date;
}

export interface ICustomBG {
  id: number;
  userId: number;
  bgId: number;
  bg: IBgProps;
  createdAt: Date;
}

export interface IVrmProps {
  id: number;
  name: string;
  file: IMedia;
  thumbnail: IMedia;
  unlockedByDefault: boolean;
  description?: string;
  tags?: string[];
  vrmConfig?: IVrmConfig;
  partners: IPartner[];
  customVrm?: ICustomVRM;
  userVRMTuning: IUserVRMTuning[];
  createdAt: Date;
  updatedAt: Date;
  /*
   * The following properties are not part of the original type definition and are being mapped onto the object in the associated context provider.
   */
  unlockedAt?: Date;
}

export interface IPartner {
  id: number;
  name: string;
  email: string;
  vrm: IVrmProps[];
}

export type IBGType = 'Static' | '360' | 'Chroma';

export interface IBgConfig {
  type: IBGType;
  color?: string;
}

export interface IUserVRMTuning {
  id: number;
  userId: number;
  vrmId: number;
  vrm: IVrmProps;
}

export interface IBgProps {
  id: number;
  name: string;
  image: IMedia;
  tags?: string[];
  unlockedByDefault: boolean;
  description?: string;
  bgConfig?: IBgConfig;
  customBg?: ICustomBG;
  defaultBg?: boolean;
  createdAt: Date;
  updatedAt: Date;
  /*
   * The following properties are not part of the original type definition and are being mapped onto the object in the associated context provider.
   */
  unlockedAt?: Date;
}

export interface IMedia {
  id: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  bgId?: number;
  bg?: IBgProps;
  agentId?: number;
  agent?: IAgent;
  voiceId?: number;
  animationFileId?: number;
  animationFile?: IAnimation;
  animationThumbnailId?: number;
  animationThumbnail?: IAnimation;
  vrmFileId?: number;
  vrmFile?: IVrmProps;
  vrmThumbnailId?: number;
  vrmThumbnail?: IVrmProps;
}

export interface IAnimation {
  id: number;
  name: string;
  file?: IMedia;
  thumbnail?: IMedia;
  description?: string;
  animationConfig?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  AgentAnimation?: IAgentAnimation[];
}

export interface IAgentAnimation {
  id: number;
  state: AnimationStates;
  agent?: IAgent;
  agentId?: number;
  animation?: IAnimation;
  animationId?: number;
}

export enum AnimationStates {
  IDLE = 'IDLE',
  TALK = 'TALK',
}

export interface IUserAgents {
  id: number;
  createdAt?: Date;
  updatedAt: Date;
  instance?: string;
  userId?: number;
  Agent?: IAgent;
  agentId?: number;
}

export interface Media {
  id: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Animation {
  id: number;
  name: string;
  description?: string | null;
  animationConfig?: Record<string, unknown> | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IAgent {
  id: number;
  name?: string;
  slug?: string;
  description?: string;
  handle?: string;
  walletAddress?: string;
  idleDelay?: number;
  walletHoldings?: number;
  bio?: string;
  socials?: { id: string; type: string; url: string }[];
  user?: IUserAgents;
  idleChat?: boolean;
  discoverability?: boolean;
  colorHexs?: Record<string, string>;
  logo?: IMedia;
  voiceService?: string;
  voiceID?: string;
  voiceSpeed?: number;
  exp?: number;
  lore?: string[];
  idle?: string[];
  contractAddress?: string;
  vectorID?: string;
  vrm?: IVrmProps;
  vrmId?: number;
  bg?: IBgProps;
  bgId?: number;
  createdAt?: Date;
  updatedAt?: Date;
  animations?: IAgentAnimation[];
  animationId?: number;
  followingAgents?: IFollowingAgents[];
  streams?: IStreams[];
  knowledge: string[];
  adjectives?: string[];
  style?: string[];
  voiceInstructions?: VoiceInstructionCategory;
  greetingMessage?: string[];
  adkDeploymentJSON?: AgentAdkCustomizations | null;
  adkAgentName?: string;
  adkDeploymentResourceName?: string;
  defaults?: IAgentDefaults | null;
}

export interface AgentAdkCustomizations {
  rootParameterValues: Record<string, string>;
  blocks: AdkBlockInstance[];
  templateName: string | null;
  personaLocation: PersonaLocation;
}

export interface AdkBlockInstance {
  instanceId: string;
  blockName: string;
  tool_name: string;
  parameterValues: Record<string, string>;
}

export type PersonaLocation = 'global_instruction' | 'instruction' | null;

export interface IAgentDefaults {
  chatboxTitle?: string;
  aboutCardHeading?: string;
  aboutCardDescription?: string;
  aboutCardLinks?: { icon: string; link: string }[];
  logoTopLeftLightModeURL?: string;
  logoTopLeftDarkModeURL?: string;
  backgroundLightModeURL?: string;
  backgroundDarkModeURL?: string;
  pageTitle?: string;
  defaultQuestionTexts?: string[];
  faviconURL?: string;
  vrmDisplay?: VRMDisplayEnums;
  messagesPerMinutePerUser?: number;
  overallMessagesPerMinute?: number;
  defaultTheme?: 'light' | 'dark';
  maximumTokensPerMessage?: number;
  pinnedMessage?: string;
  pinnedMessageSeverity?: PinnedMessageSeverity;
  bannerURL?: string;
  enableVoiceButton?: boolean;
  accentColorHex?: string;
}

export enum PinnedMessageSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  OFFER = 'OFFER',
  ATTENTION = 'ATTENTION',
}

export enum VRMDisplayEnums {
  NONE = 'NONE',
  VISUALIZER = 'VISUALIZER',
  VRM = 'VRM',
  TWO_DIMENSIONAL = 'TWO_DIMENSIONAL',
  BANNER = 'BANNER',
}

export interface IFollowingAgents {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
  userId?: number;
  Agent?: IAgent;
  agentId?: number;
}

export interface VoiceInstructionCategory {
  affect?: string;
  style?: string;
  pacing?: string;
  pronunciation?: string;
  pitch?: string;
}

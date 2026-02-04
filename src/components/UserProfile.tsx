import React from "react";
import { Box, Text } from "ink";
import { UserProfile } from "../agents/user.js";

interface UserProfileProps {
  profile: UserProfile | null;
  loading: boolean;
  onBack: () => void;
}

export function UserProfile({ profile, loading, onBack }: UserProfileProps) {
  if (loading) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">Loading profile...</Text>
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text color="red">Not authenticated or failed to load profile.</Text>
        <Text color="dim">
          (In this environment, you likely don't have valid cookies)
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Text bold color="magenta">
        User Profile
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text bold>Name:</Text> {profile.displayName}
        </Text>
        <Text>
          <Text bold>Email:</Text> {profile.email}
        </Text>
        <Text>
          <Text bold>ID:</Text> {profile.id}
        </Text>
        {profile.postCode && (
          <Text>
            <Text bold>Location:</Text> {profile.postCode}{" "}
            {profile.city}
          </Text>
        )}
        {profile.memberSince && (
          <Text>
            <Text bold>Member Since:</Text> {profile.memberSince}
          </Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text color="dim">Esc: Back</Text>
      </Box>
    </Box>
  );
}

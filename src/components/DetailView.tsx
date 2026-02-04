import React from "react";
import { Box, Text } from "ink";
import { ListingDetail } from "../types.js";
import { createImageFrame, createSmallIcon } from "./ascii-art.js";

interface DetailViewProps {
  listing: ListingDetail | null;
  loading: boolean;
  onBack: () => void;
}

export function DetailView({ listing, loading, onBack }: DetailViewProps) {
  if (loading) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">Loading details...</Text>
      </Box>
    );
  }

  if (!listing) return null;

  const hasImages = listing.images && listing.images.length > 0;

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="white"
      padding={1}
    >
      {/* Image Preview Section */}
      {hasImages && (
        <Box flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold color="cyan">Images ({listing.images.length}):</Text>
            <Text color="dim">Use arrows: ← → to browse</Text>
          </Box>
          <Box
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
          >
            {listing.images.map((img, index) => {
              const isMain = index === 0;
              return (
                <Box key={index} flexDirection="column" marginTop={0}>
                  <Text color={isMain ? "yellow" : "dim"}>
                    [{index + 1} / {listing.images.length}] {isMain ? "(Main)" : ""}
                  </Text>
                  <Text color="cyan">
                    {createImageFrame(true)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Product Info */}
      <Text bold color="green">
        {createSmallIcon(true)} {listing.title}
      </Text>
      <Text color="yellow">{listing.priceText}</Text>
      <Text color="dim">ID: {listing.id}</Text>

      <Box marginTop={1}>
        <Text>
          {listing.fullDescription || listing.description}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="cyan">Location: {listing.location}</Text>
        <Text color="cyan">Seller: {listing.sellerName}</Text>
        {listing.paylivery && (
          <Text color="magenta">✓ PayLivery Available</Text>
        )}
      </Box>

      {listing.attributes &&
        Object.keys(listing.attributes).length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Attributes:</Text>
            {Object.entries(listing.attributes).map(([key, val]) => (
              <Text key={key} color="dim">
                - {key}: {Array.isArray(val) ? val.join(", ") : val}
              </Text>
            ))}
          </Box>
        )}

      <Box marginTop={1}>
        <Text color="dim">Press Left Arrow to go back</Text>
      </Box>
    </Box>
  );
}

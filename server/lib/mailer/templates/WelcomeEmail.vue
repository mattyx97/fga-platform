<script setup lang="ts">
const {
  userName = 'test',
  confirmationUrl = 'https://example.com',
} = defineProps<{
  userName: string
  confirmationUrl: string
}>()
</script>

<template>
  <EHtml>
    <ESubject>Welcome {{ userName }}!</ESubject>
    <EHead />
    <EBody>
      <EContainer>
        <EHeading>Welcome {{ userName }}!</EHeading>
        <EText>
          Thank you for joining our platform. We're excited to have you on board!
        </EText>
        <EButton :href="confirmationUrl">
          Confirm Your Account
        </EButton>
      </EContainer>
    </EBody>
  </EHtml>
</template>

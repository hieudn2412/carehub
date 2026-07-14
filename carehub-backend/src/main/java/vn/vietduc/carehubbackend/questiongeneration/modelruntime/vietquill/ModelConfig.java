package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

/**
 * Cấu hình tokenizer cho seq2seq model (decoder start, EOS, PAD token IDs).
 */
record ModelConfig(int decoderStartTokenId, int eosTokenId, int padTokenId) {
}

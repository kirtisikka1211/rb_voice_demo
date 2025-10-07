# main.py
import asyncio
import os
from dotenv import load_dotenv
from cli import extract_file_content
import os
from bot import InterviewBot

from logger_config import get_logger

logger = get_logger("main")

def select_voice():
    voices = {"1": "cedar", "2": "marin", "3": "alloy", "4": "echo", "5":"fable","6":"onyx","7":"nova","8":"shimmer"}
    print("\n🎵 Select a voice:")
    for key, voice in voices.items():
        print(f"{key}. {voice.title()}")
    try:
        choice = input("\nEnter choice (1-8, default: cedar): ").strip()
        if not choice:
            choice = "1"
        return voices.get(choice, "cedar")
    except (KeyboardInterrupt, EOFError):
        return "cedar"

def get_interview_duration():
    while True:
        try:
            duration_input = input("\n⏱️  Enter interview duration in minutes (default: 30): ").strip()
            if not duration_input:
                return 30
            duration = int(duration_input)
            if duration < 5 or duration > 120:
                print("Duration must be between 5 and 120 minutes")
                continue
            return duration
        except ValueError:
            print("Please enter a valid number")
        except (KeyboardInterrupt, EOFError):
            return 30





async def main():
    load_dotenv()
    api_key = ""
    if not api_key:
        print("❌ OPENAI_API_KEY not set")
        return

    # FILE PATHS - Edit these to add files
    jd_file = "/Users/kirtisikka/Downloads/voice/files/2_jd_20250930_065954_Computer Vision Fresher JD.pdf"
    resume_file = "https://ceywatgfpiyfdhrqfbip.supabase.co/storage/v1/object/public/files/resumes/resume_20250930_112843_Resume_KirtiSIKKA.pdf"  # Add resume file path here  
    questions_file = None# Add custom questions file path here
    
    print("🎯 AI INTERVIEW BOT")
    print("🤖 Powered by GPT-Realtime\n")
    
    # Get user preferences
    selected_voice = select_voice()
    interview_duration = get_interview_duration()
    
    print(f"\n🎵 Selected voice: {selected_voice}")
    print(f"⏱️  Interview duration: {interview_duration} minutes")

    # Load and validate files
    print("\n📂 FILE STATUS:")
    
    jd_content = ""
    resume_content = ""
    questions_content = ""
    
    # Job Description
    if jd_file:
        try:
            jd_content = extract_file_content(jd_file)
            print(f"✅ Job Description loaded: {jd_file}")
        except Exception as e:
            print(f"❌ Job Description error: {jd_file} - {e}")
    else:
        print("➖ Job Description: Not provided")
    
    # Resume
    if resume_file:
        try:
            resume_content = extract_file_content(resume_file)
            print(f"✅ Resume loaded: {resume_file}")
        except Exception as e:
            print(f"❌ Resume error: {resume_file} - {e}")
    else:
        print("➖ Resume: Not provided")
    
    # Custom Questions
    if questions_file:
        try:
            questions_content = extract_file_content(questions_file)
            print(f"✅ Custom Questions loaded: {questions_file}")
        except Exception as e:
            print(f"❌ Custom Questions error: {questions_file} - {e}")
    else:
        print("➖ Custom Questions: Not provided")
    
    # Create bot and set mode
    bot = InterviewBot(api_key, voice=selected_voice, language="en", interview_duration=interview_duration)
    
    if jd_content and resume_content:
        # Write temp files for load_interview_context
        os.makedirs("temp", exist_ok=True)
        temp_jd = "temp/jd.txt"
        temp_resume = "temp/resume.txt"
        temp_questions = "temp/questions.txt" if questions_content else None
        
        with open(temp_jd, 'w', encoding='utf-8') as f:
            f.write(jd_content)
        with open(temp_resume, 'w', encoding='utf-8') as f:
            f.write(resume_content)
        if questions_content:
            with open(temp_questions, 'w', encoding='utf-8') as f:
                f.write(questions_content)
        
        # Use load_interview_context which handles caching
        bot.load_interview_context(temp_jd, temp_resume, temp_questions)
        
        # Cleanup temp files
        os.remove(temp_jd)
        os.remove(temp_resume)
        if temp_questions:
            os.remove(temp_questions)
        os.rmdir("temp")
    else:
        print("\n💬 CONVERSATION MODE ACTIVATED")
        print("(Both JD and Resume required for Interview Mode)")

    try:
        await bot.run()
    except KeyboardInterrupt:
        print("Session ended by user")
    finally:
        bot.print_summary()
        saved_file = bot.save_transcript()
        if saved_file and bot.interview_mode:
            print(f"\n📊 COMPREHENSIVE INTERVIEW EVALUATION:")
            if getattr(bot, 'evaluation_data', None):
                # New enhanced evaluation format
                if 'overall_assessment' in bot.evaluation_data:
                    overall = bot.evaluation_data['overall_assessment']
                    technical = bot.evaluation_data['technical_competency']
                    communication = bot.evaluation_data['communication_assessment']
                    
                    # Scores already formatted like '7/10'
                    print(f"   🎯 Overall Score: {overall['score']}")
                    print(f"   � Technical Score: {technical['score']}")
                    print(f"   💬 Communication Score: {communication['score']}")
                    
                    # Show if audio was analyzed
                    if bot.evaluation_data.get('evaluation_metadata', {}).get('audio_analyzed'):
                        print("   🎵 Audio Analysis: Included")
                else:
                    # Fallback to old format if present
                    eval_data = bot.evaluation_data.get('evaluation', {})
                    if eval_data:
                        print(f"   📊 Overall Assessment: {eval_data.get('1. OVERALL ASSESSMENT', {}).get('score', 'N/A')}/5")
                        print(f"   🔧 Technical Competency: {eval_data.get('2. TECHNICAL COMPETENCY', {}).get('score', 'N/A')}/5")
                
                # Show question coverage
                total_custom = len(bot.custom_questions) + len(bot.prescreening_questions) + len(bot.technical_custom_questions)
                if total_custom > 0:
                    covered = total_custom - len(bot._get_remaining_custom_questions())
                    print(f"   📝 Custom Questions Covered: {covered}/{total_custom}")
            print("   📄 Check transcript and JSON files for detailed analysis")

if __name__ == "__main__":
    print("🎯 AI INTERVIEW & VOICE BOT")
    print("🤖 Powered by GPT-Realtime")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Exited by user")
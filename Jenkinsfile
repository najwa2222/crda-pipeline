pipeline {
    agent any

    environment {
        REPO_URL = 'https://github.com/najwa2222/crda-pipeline.git'
        DOCKER_IMAGE = 'najwa22/crda-app'
        KUBE_DIR = 'kubernetes'
        KUBECONFIG = credentials('kubeconfig')
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [],
                    userRemoteConfigs: [[
                        url: env.REPO_URL,
                        credentialsId: 'github-creds'
                    ]]
                ])
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                script {
                    def fullTag = "${env.DOCKER_IMAGE}:${env.BUILD_ID}"
                    docker.build(fullTag)
                    docker.withRegistry('https://registry.hub.docker.com', 'dockerhub-credentials') {
                        docker.image(fullTag).push()
                    }
                }
            }
        }

        stage('Prepare K8s Manifests') {
            steps {
                script {
                    def deployment = readFile("${env.KUBE_DIR}/app-deployment.yaml")
                    deployment = deployment.replace('${BUILD_ID}', env.BUILD_ID)
                    writeFile(
                        file: "${env.KUBE_DIR}/app-deployment-${env.BUILD_ID}.yaml", 
                        text: deployment
                    )
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat """
                    kubectl apply -f ${env.KUBE_DIR}/mysql-secret.yaml
                    kubectl apply -f ${env.KUBE_DIR}/mysql-pv.yaml
                    kubectl apply -f ${env.KUBE_DIR}/mysql-configmap.yaml
                    kubectl apply -f ${env.KUBE_DIR}/mysql-deployment.yaml
                    kubectl apply -f ${env.KUBE_DIR}/app-deployment-${env.BUILD_ID}.yaml
                    
                    timeout /t 30 /nobreak
                    kubectl get pods -w
                """
            }
        }
    }

    post {
        always {
            bat "del /Q ${env.KUBE_DIR}\\app-deployment-*.yaml 2> nul"
            echo "Cleanup complete"
        }
        success {
            bat "kubectl get svc crda-service"
        }
        failure {
            bat "kubectl describe pods"
            bat "kubectl get events --sort-by=.metadata.creationTimestamp"
        }
    }
}